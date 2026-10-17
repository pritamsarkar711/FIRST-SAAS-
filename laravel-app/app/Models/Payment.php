<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    use HasUlids;

    protected $table = 'payments';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = null;

    protected $fillable = [
        'userId', 'planId', 'planName', 'amount', 'currency', 'amountBdt',
        'gateway', 'senderInfo', 'txId', 'status', 'note', 'meta', 'reviewedAt',
    ];

    protected $casts = [
        'amount' => 'float',
        'amountBdt' => 'float',
        'reviewedAt' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'planId');
    }

    public function earnings(): HasMany
    {
        return $this->hasMany(AffiliateEarning::class, 'paymentId');
    }
}
