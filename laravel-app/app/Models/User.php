<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use \Illuminate\Database\Eloquent\Concerns\HasUlids;

    protected $table = 'users';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $fillable = [
        'email', 'passwordHash', 'name', 'image', 'role', 'status',
        'credits', 'referralCode', 'referredById', 'twoFactorSecret', 'twoFactorEnabled',
    ];

    protected $hidden = ['passwordHash', 'twoFactorSecret'];

    protected $casts = [
        'credits' => 'integer',
        'twoFactorEnabled' => 'boolean',
    ];

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referredById');
    }

    public function referredUsers(): HasMany
    {
        return $this->hasMany(User::class, 'referredById');
    }

    public function audits(): HasMany
    {
        return $this->hasMany(Audit::class, 'userId');
    }

    public function watchItems(): HasMany
    {
        return $this->hasMany(WatchItem::class, 'userId');
    }

    public function apiKeys(): HasMany
    {
        return $this->hasMany(ApiKey::class, 'userId');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'userId');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class, 'userId');
    }

    public function contentJobs(): HasMany
    {
        return $this->hasMany(ContentJob::class, 'userId');
    }

    public function indexRequests(): HasMany
    {
        return $this->hasMany(IndexRequest::class, 'userId');
    }

    public function earnings(): HasMany
    {
        return $this->hasMany(AffiliateEarning::class, 'userId');
    }

    public function earningSources(): HasMany
    {
        return $this->hasMany(AffiliateEarning::class, 'fromUserId');
    }

    public function withdrawals(): HasMany
    {
        return $this->hasMany(Withdrawal::class, 'userId');
    }

    public function blogPosts(): HasMany
    {
        return $this->hasMany(BlogPost::class, 'authorId');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ContactMessage::class, 'userId');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'userId');
    }
}
