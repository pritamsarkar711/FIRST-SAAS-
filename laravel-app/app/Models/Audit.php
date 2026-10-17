<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Audit extends Model
{
    use HasUlids;

    protected $table = 'audits';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $fillable = [
        'userId', 'domain', 'target', 'mode', 'status', 'probability', 'verdict',
        'report', 'signals', 'deepScan', 'error', 'creditsUsed', 'shareToken',
        'batchId', 'watchItemId',
    ];

    protected $casts = [
        'probability' => 'integer',
        'deepScan' => 'boolean',
        'creditsUsed' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function watchItem(): BelongsTo
    {
        return $this->belongsTo(WatchItem::class, 'watchItemId');
    }
}
