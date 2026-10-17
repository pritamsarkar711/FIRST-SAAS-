<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AffiliateEarning extends Model
{
    use HasUlids;

    protected $table = 'affiliate_earnings';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = null;

    protected $fillable = ['userId', 'fromUserId', 'paymentId', 'amount', 'status'];

    protected $casts = ['amount' => 'float'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function fromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'fromUserId');
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class, 'paymentId');
    }
}
