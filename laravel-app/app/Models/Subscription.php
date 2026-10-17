<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    use HasUlids;

    protected $table = 'subscriptions';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = 'startedAt';
    const UPDATED_AT = null;

    protected $fillable = ['userId', 'planId', 'planName', 'credits', 'status', 'startedAt', 'expiresAt'];

    protected $casts = ['credits' => 'integer', 'expiresAt' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
