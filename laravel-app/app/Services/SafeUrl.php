<?php

namespace App\Services;

/**
 * Port of src/lib/guard.ts - validates that a user-supplied URL points at a
 * public http(s) address. Blocks SSRF targets (localhost, private ranges,
 * literal IPs in private space, non-standard ports, credentials).
 */
class SafeUrl
{
    private const PRIVATE_V4 = [
        ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
        ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16],
        ['192.0.0.0', 24], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
    ];

    /**
     * @return array{url: array{scheme:string,host:string,port?:int,path:string,query?:string}, hostname: string}
     * @throws \InvalidArgumentException
     */
    public static function assertPublicUrl(string $input): array
    {
        $input = trim($input);
        $normalized = str_contains($input, '://') ? $input : 'https://' . $input;
        $parts = parse_url($normalized);
        if (! $parts || empty($parts['host'])) {
            throw new \InvalidArgumentException('Invalid URL');
        }
        $scheme = strtolower($parts['scheme'] ?? 'https');
        if (! in_array($scheme, ['http', 'https'], true)) {
            throw new \InvalidArgumentException('Only http and https URLs are allowed');
        }
        if (isset($parts['port']) && ! in_array($parts['port'], [80, 443], true)) {
            throw new \InvalidArgumentException('Non-standard ports are not allowed');
        }
        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new \InvalidArgumentException('Credentials in URL are not allowed');
        }

        $hostname = strtolower($parts['host']);
        $hostname = preg_replace('/^\[|\]$/', '', $hostname);

        if ($hostname === 'localhost' || str_ends_with($hostname, '.localhost')
            || str_ends_with($hostname, '.local') || str_ends_with($hostname, '.internal')) {
            throw new \InvalidArgumentException('Local addresses are not allowed');
        }

        if (preg_match('/^\d{1,3}(\.\d{1,3}){3}$/', $hostname)) {
            if (self::isPrivateV4($hostname)) {
                throw new \InvalidArgumentException('Private addresses are not allowed');
            }

            return ['url' => $parts, 'hostname' => $hostname];
        }

        if (str_contains($hostname, ':')) {
            if (self::isPrivateV6($hostname)) {
                throw new \InvalidArgumentException('Private addresses are not allowed');
            }

            return ['url' => $parts, 'hostname' => $hostname];
        }

        // Domain: every resolved address must be public
        $addresses = @dns_get_record($hostname, DNS_A | DNS_AAAA);
        if ($addresses === false || ! $addresses) {
            // Retry common subdomain resolution quirk through A lookup
            $addresses = @dns_get_record($hostname, DNS_A);
            if (! $addresses) {
                throw new \InvalidArgumentException('This domain does not resolve. Check the spelling or register it first.');
            }
        }
        foreach ($addresses as $a) {
            if (isset($a['ip']) && self::isPrivateV4($a['ip'])) {
                throw new \InvalidArgumentException('Private addresses are not allowed');
            }
            if (isset($a['ipv6']) && self::isPrivateV6($a['ipv6'])) {
                throw new \InvalidArgumentException('Private addresses are not allowed');
            }
        }

        return ['url' => $parts, 'hostname' => $hostname];
    }

    /** Full https URL rebuilt from the parsed parts (for fetching). */
    public static function buildUrl(array $parts, string $path = '/', string $query = ''): string
    {
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? '';
        $port = isset($parts['port']) ? ':' . $parts['port'] : '';
        $p = $path ?: '/';
        $q = $query !== '' ? '?' . $query : '';

        return "{$scheme}://{$host}{$port}{$p}{$q}";
    }

    public static function normalizeDomain(string $input): string
    {
        $d = strtolower(trim($input));
        $d = preg_replace('#^https?://#', '', $d);
        $d = preg_replace('#^www\.#', '', $d);
        $d = explode('/', $d)[0] ?? '';
        $d = explode('?', $d)[0] ?? '';
        $d = explode('#', $d)[0] ?? '';

        return $d;
    }

    private static function isPrivateV4(string $ip): bool
    {
        $n = ip2long($ip);
        if ($n === false) {
            return true;
        }
        foreach (self::PRIVATE_V4 as [$net, $bits]) {
            $base = ip2long($net);
            $mask = $bits === 0 ? 0 : (-1 << (32 - $bits)) & 0xFFFFFFFF;
            if (($n & $mask) === ($base & $mask)) {
                return true;
            }
        }

        return false;
    }

    private static function isPrivateV6(string $ip): bool
    {
        $l = strtolower($ip);
        if ($l === '::' || $l === '::1') {
            return true;
        }
        if (str_starts_with($l, 'fe80') || str_starts_with($l, 'fc') || str_starts_with($l, 'fd')) {
            return true;
        }
        if (str_starts_with($l, '::ffff:')) {
            return self::isPrivateV4(substr($l, 7));
        }

        return false;
    }
}
