<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#f86642">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="preload" href="/fonts/Telenor-Regular.woff" as="font" type="font/woff" crossorigin="anonymous">
    <link rel="preload" href="/fonts/Telenor-Bold.woff" as="font" type="font/woff" crossorigin="anonymous">
    <title inertia>{{ ($seo['title'] ?? null) ?: (\App\Services\Settings::site()['name'] ?? 'Audit Form') }} — Know your AdSense approval odds before you apply</title>
    <meta name="description" content="{{ $seo['description'] ?? 'Audit Form audits your blog against Google AdSense and premium ad network policies, shows a clear approval probability with green, orange and red findings, and gives you a fix-first roadmap and PDF report.' }}">
    @routes
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="antialiased bg-background text-foreground min-h-screen flex flex-col">
    @inertia
</body>
</html>
