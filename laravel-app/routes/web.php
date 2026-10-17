<?php

use App\Http\Controllers\Api\Admin as AdminApi;
use App\Http\Controllers\Api\AffiliateApiController;
use App\Http\Controllers\Api\AuditApiController;
use App\Http\Controllers\Api\AuthApiController;
use App\Http\Controllers\Api\BillingApiController;
use App\Http\Controllers\Api\ContactApiController;
use App\Http\Controllers\Api\ExportApiController;
use App\Http\Controllers\Api\IndexerApiController;
use App\Http\Controllers\Api\KeysApiController;
use App\Http\Controllers\Api\NotificationsApiController;
use App\Http\Controllers\Api\SecurityApiController;
use App\Http\Controllers\Api\SettingsApiController;
use App\Http\Controllers\Api\SiteCheckApiController;
use App\Http\Controllers\Api\TwoFactorApiController;
use App\Http\Controllers\Api\UploadApiController;
use App\Http\Controllers\Api\V1\AuditsApiController as V1AuditsApiController;
use App\Http\Controllers\Api\WatchlistApiController;
use App\Http\Controllers\Api\WriterApiController;
use App\Http\Controllers\Admin\PanelController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\GoogleController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Dashboard as Dash;
use App\Http\Controllers\Site\AuthPageController;
use App\Http\Controllers\Site\BlogController;
use App\Http\Controllers\Site\ContactPageController;
use App\Http\Controllers\Site\HomeController;
use App\Http\Controllers\Site\PageController;
use App\Http\Controllers\Site\ShareController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public site (Inertia pages)
|--------------------------------------------------------------------------
*/
Route::get('/', HomeController::class)->name('home');
Route::get('/login', [AuthPageController::class, 'login'])->middleware('guest')->name('login');
Route::get('/register', [AuthPageController::class, 'register'])->middleware('guest')->name('register');
Route::get('/pricing', [PageController::class, 'pricing']);
Route::get('/features', [PageController::class, 'features']);
Route::get('/how-it-works', [PageController::class, 'howItWorks']);
Route::get('/tools', [PageController::class, 'tools']);
Route::get('/sample-report', [PageController::class, 'sampleReport']);
Route::get('/about', [PageController::class, 'about']);
Route::get('/terms', [PageController::class, 'terms']);
Route::get('/privacy', [PageController::class, 'privacy']);
Route::get('/refund', [PageController::class, 'refund']);
Route::get('/docs/api', [PageController::class, 'docsApi']);
Route::get('/blog', [BlogController::class, 'index']);
Route::get('/blog/{slug}', [BlogController::class, 'show']);
Route::get('/contact', ContactPageController::class);
Route::get('/share/{token}', ShareController::class);
Route::get('/up', fn () => response('ok', 200));

/*
|--------------------------------------------------------------------------
| Auth (same endpoints as the Next.js app; session based)
|--------------------------------------------------------------------------
*/
Route::post('/api/auth/login', [AuthController::class, 'login']);
Route::post('/api/auth/logout', [AuthController::class, 'logout']);
Route::get('/logout', [AuthController::class, 'logoutWeb'])->name('logout.web');
Route::post('/api/auth/register', [RegisterController::class, 'store']);
Route::post('/api/auth/2fa/setup', [TwoFactorApiController::class, 'setup'])->middleware('auth');
Route::post('/api/auth/2fa/enable', [TwoFactorApiController::class, 'enable'])->middleware('auth');
Route::post('/api/auth/2fa/disable', [TwoFactorApiController::class, 'disable'])->middleware('auth');
Route::get('/auth/google/redirect', [GoogleController::class, 'redirect']);
Route::get('/auth/google/callback', [GoogleController::class, 'callback']);

/*
|--------------------------------------------------------------------------
| Public API (free tools, contact, security view)
|--------------------------------------------------------------------------
*/
Route::get('/api/tools/site-check', [SiteCheckApiController::class, 'run']);
Route::post('/api/contact', [ContactApiController::class, 'store']);
Route::get('/api/site', [AuthApiController::class, 'site']);
Route::get('/api/security', [SecurityApiController::class, 'index'])->middleware('auth');

/*
|--------------------------------------------------------------------------
| Dashboard API (session auth - same paths as the original /api routes)
|--------------------------------------------------------------------------
*/
Route::middleware('auth')->group(function () {
    Route::get('/api/me', [AuthApiController::class, 'me']);

    // Audits
    Route::get('/api/audit', [AuditApiController::class, 'index']);
    Route::post('/api/audit', [AuditApiController::class, 'store']);
    Route::get('/api/audit/{id}', [AuditApiController::class, 'show']);
    Route::delete('/api/audit/{id}', [AuditApiController::class, 'destroy']);
    Route::post('/api/audit/{id}/share', [AuditApiController::class, 'share']);
    Route::delete('/api/audit/{id}/share', [AuditApiController::class, 'shareRevoke']);
    // Legacy path: the PDF is now rendered client-side; return the payload.
    Route::get('/api/audit/{id}/pdf', [AuditApiController::class, 'pdf']);

    // Watchlist / monitors
    Route::get('/api/watchlist', [WatchlistApiController::class, 'index']);
    Route::post('/api/watchlist', [WatchlistApiController::class, 'store']);
    Route::patch('/api/watchlist/{id}', [WatchlistApiController::class, 'update']);
    Route::delete('/api/watchlist/{id}', [WatchlistApiController::class, 'destroy']);
    Route::post('/api/watchlist/{id}/run', [WatchlistApiController::class, 'run']);
    Route::post('/api/watchlist/tick', [WatchlistApiController::class, 'tick']);

    // Writer
    Route::get('/api/writer', [WriterApiController::class, 'index']);
    Route::post('/api/writer', [WriterApiController::class, 'store']);
    Route::get('/api/writer/{id}', [WriterApiController::class, 'show']);
    Route::delete('/api/writer/{id}', [WriterApiController::class, 'destroy']);
    Route::post('/api/writer/{id}/publish-wp', [WriterApiController::class, 'publishWp']);

    // Quick indexer
    Route::post('/api/indexer', [IndexerApiController::class, 'store']);
    Route::get('/api/indexer', [IndexerApiController::class, 'index']);

    // Billing
    Route::get('/api/billing', [BillingApiController::class, 'index']);
    Route::post('/api/billing', [BillingApiController::class, 'store']);
    Route::match(['post', 'get'], '/api/billing/stripe/verify', [BillingApiController::class, 'verifyStripe']);
    Route::match(['post', 'get'], '/api/billing/paypal/verify', [BillingApiController::class, 'verifyPaypal']);
    Route::match(['post', 'get'], '/api/billing/sslcommerz/verify', [BillingApiController::class, 'verifySslcommerz']);

    // Affiliate
    Route::get('/api/affiliate', [AffiliateApiController::class, 'index']);
    Route::post('/api/affiliate', [AffiliateApiController::class, 'withdraw']);

    // Misc
    Route::get('/api/keys', [KeysApiController::class, 'index']);
    Route::post('/api/keys', [KeysApiController::class, 'store']);
    Route::delete('/api/keys', [KeysApiController::class, 'destroy']);
    Route::get('/api/notifications', [NotificationsApiController::class, 'index']);
    Route::post('/api/notifications', [NotificationsApiController::class, 'markRead']);
    Route::get('/api/settings', [SettingsApiController::class, 'show']);
    Route::patch('/api/settings', [SettingsApiController::class, 'update']);
    Route::post('/api/upload', [UploadApiController::class, 'store']);
    Route::get('/api/export/audits', [ExportApiController::class, 'audits']);
    Route::get('/api/export/domain', [ExportApiController::class, 'domain']);
});

/*
|--------------------------------------------------------------------------
| Public developer API v1 (X-Api-Key)
|--------------------------------------------------------------------------
*/
Route::middleware('api.key')->prefix('api/v1')->group(function () {
    Route::post('/audits', [V1AuditsApiController::class, 'store']);
    Route::get('/audits/{id}', [V1AuditsApiController::class, 'show']);
});

/*
|--------------------------------------------------------------------------
| Admin API (session auth + admin role)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'admin'])->prefix('api/admin')->group(function () {
    Route::get('/users', [AdminApi\UsersController::class, 'index']);
    Route::post('/users', [AdminApi\UsersController::class, 'store']);
    Route::match(['patch', 'post'], '/users', [AdminApi\UsersController::class, 'update']);
    Route::delete('/users', [AdminApi\UsersController::class, 'destroy']);

    Route::get('/audits', [AdminApi\AuditsController::class, 'index']);
    Route::delete('/audits', [AdminApi\AuditsController::class, 'destroy']);

    Route::get('/monitors', [AdminApi\MonitorsController::class, 'index']);
    Route::match(['patch', 'post'], '/monitors', [AdminApi\MonitorsController::class, 'update']);

    Route::get('/payments', [AdminApi\PaymentsController::class, 'index']);
    Route::match(['patch', 'post'], '/payments', [AdminApi\PaymentsController::class, 'update']);

    Route::get('/plans', [AdminApi\PlansController::class, 'index']);
    Route::post('/plans', [AdminApi\PlansController::class, 'store']);
    Route::match(['patch', 'post'], '/plans', [AdminApi\PlansController::class, 'update']);
    Route::delete('/plans', [AdminApi\PlansController::class, 'destroy']);

    Route::get('/gateways', [AdminApi\GatewaysController::class, 'index']);
    Route::match(['patch', 'post'], '/gateways', [AdminApi\GatewaysController::class, 'update']);

    Route::get('/affiliate', [AdminApi\AffiliateController::class, 'index']);
    Route::match(['patch', 'post'], '/affiliate', [AdminApi\AffiliateController::class, 'update']);

    Route::get('/messages', [AdminApi\MessagesController::class, 'index']);
    Route::match(['patch', 'post'], '/messages', [AdminApi\MessagesController::class, 'update']);

    Route::get('/posts', [AdminApi\PostsController::class, 'index']);
    Route::post('/posts', [AdminApi\PostsController::class, 'store']);
    Route::match(['patch', 'post'], '/posts', [AdminApi\PostsController::class, 'update']);
    Route::delete('/posts', [AdminApi\PostsController::class, 'destroy']);

    Route::get('/settings', [AdminApi\SettingsController::class, 'show']);
    Route::match(['patch', 'post', 'put'], '/settings', [AdminApi\SettingsController::class, 'update']);
    Route::post('/settings/test-email', [AdminApi\SettingsController::class, 'testEmail']);

    Route::get('/activity', [AdminApi\ActivityController::class, 'index']);
    Route::match(['get', 'post'], '/digest', [AdminApi\DigestController::class, 'index']);
    Route::get('/export', [ExportApiController::class, 'admin']);
});

/*
|--------------------------------------------------------------------------
| Dashboard pages (session auth)
|--------------------------------------------------------------------------
*/
Route::middleware('auth')->group(function () {
    Route::get('/dashboard', [Dash\OverviewController::class, 'index']);
    Route::get('/dashboard/audit', [Dash\AuditPageController::class, 'index']);
    Route::get('/dashboard/audit/{id}', [Dash\AuditPageController::class, 'show']);
    Route::get('/dashboard/domains', [Dash\DomainsPageController::class, 'index']);
    Route::get('/dashboard/domains/{domain}', [Dash\DomainsPageController::class, 'show']);
    Route::get('/dashboard/watchlist', [Dash\WatchlistPageController::class, 'index']);
    Route::get('/dashboard/writer', [Dash\WriterPageController::class, 'index']);
    Route::get('/dashboard/indexer', [Dash\IndexerPageController::class, 'index']);
    Route::get('/dashboard/affiliate', [Dash\AffiliatePageController::class, 'index']);
    Route::get('/dashboard/billing', [Dash\BillingPageController::class, 'index']);
    Route::get('/dashboard/billing/checkout', [Dash\BillingPageController::class, 'checkout']);
    Route::get('/dashboard/billing/checkout/success', [Dash\BillingPageController::class, 'checkoutSuccess']);
    Route::get('/dashboard/settings', [Dash\SettingsPageController::class, 'index']);
});

/*
|--------------------------------------------------------------------------
| Admin panel pages
|--------------------------------------------------------------------------
*/
Route::get('/manage/login', [PanelController::class, 'showLogin'])->middleware('guest');

Route::middleware(['auth', 'admin'])->prefix('/manage')->group(function () {
    Route::get('/', [PanelController::class, 'dashboard']);
    Route::get('/users', [PanelController::class, 'users']);
    Route::get('/audits', [PanelController::class, 'audits']);
    Route::get('/monitors', [PanelController::class, 'monitors']);
    Route::get('/payments', [PanelController::class, 'payments']);
    Route::get('/plans', [PanelController::class, 'plans']);
    Route::get('/gateways', [PanelController::class, 'gateways']);
    Route::get('/affiliate', [PanelController::class, 'affiliate']);
    Route::get('/messages', [PanelController::class, 'messages']);
    Route::get('/blog', [PanelController::class, 'blog']);
    Route::get('/activity', [PanelController::class, 'activity']);
    Route::get('/settings', [PanelController::class, 'settings']);
});

/*
|--------------------------------------------------------------------------
| Fallbacks
|--------------------------------------------------------------------------
*/
Route::fallback(function () {
    abort(404);
});
