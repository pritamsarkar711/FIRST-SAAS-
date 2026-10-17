<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApiKey extends Model
{
    use HasUlids;

    protected $table = 'api_keys';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = null;

    protected $fillable = [
        'userId', 'name', 'prefix', 'keyHash', 'lastUsedAt', 'requestCount', 'dailyCap', 'revokedAt',
    ];

    protected $casts = [
        'requestCount' => 'integer',
        'dailyCap' => 'integer',
        'lastUsedAt' => 'datetime',
        'revokedAt' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function usage(): HasMany
    {
        return $this->hasMany(ApiKeyUsage::class, 'keyId');
    }
}
