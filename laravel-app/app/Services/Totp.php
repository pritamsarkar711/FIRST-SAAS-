<?php

namespace App\Services;

use PragmaRX\Google2FA\Google2FA;

/**
 * Port of src/lib/totp.ts - TOTP secret generation, otpauth URI and
 * verification with a 1-step window (matches the otplib behaviour).
 */
class Totp
{
    private static ?Google2FA $engine = null;

    private static function engine(): Google2FA
    {
        if (! self::$engine) {
            self::$engine = new Google2FA();
            self::$engine->setWindow(1);
        }

        return self::$engine;
    }

    public static function secret(): string
    {
        return self::engine()->generateSecretKey(32);
    }

    public static function keyuri(string $email, string $issuer, string $secret): string
    {
        return self::engine()->getQRCodeUrl($email, $issuer, $secret);
    }

    public static function verify(string $token, string $secret): bool
    {
        $token = preg_replace('/\s+/', '', $token);
        if (! preg_match('/^\d{6}$/', $token)) {
            return false;
        }
        try {
            return (bool) self::engine()->verifyKey($secret, $token);
        } catch (\Throwable) {
            return false;
        }
    }

    /** Inline SVG QR data-URI for the otpauth:// URI. */
    public static function qrSvg(string $otpauthUri): string
    {
        $renderer = new \BaconQrCode\Renderer\ImageRenderer(
            new \BaconQrCode\Renderer\RendererStyle\RendererStyle(220, 1),
            new \BaconQrCode\Renderer\Image\SvgImageBackEnd()
        );
        $writer = new \BaconQrCode\Writer($renderer);

        return 'data:image/svg+xml;base64,' . base64_encode($writer->writeString($otpauthUri));
    }
}
