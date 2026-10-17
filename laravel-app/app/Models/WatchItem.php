<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WatchItem extends Model
{
    use HasUlids;

    protected $table = 'watch_items';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $fillable = [
        'userId', 'domain', 'target', 'mode', 'deepScan', 'intervalDays', 'active',
        'lastAuditId', 'lastScore', 'lastRunAt', 'nextRunAt', 'runs', 'pausedReason',
    ];

    protected $casts = [
        'deepScan' => 'boolean',
        'active' => 'boolean',
        'intervalDays' => 'integer',
        'lastScore' => 'integer',
        'runs' => 'integer',
        'lastRunAt' => 'datetime',
        'nextRunAt' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function audits(): HasMany
    {
        return $this->hasMany(Audit::class, 'watchItemId');
    }
}
