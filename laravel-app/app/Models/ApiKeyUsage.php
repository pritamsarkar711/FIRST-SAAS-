<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApiKeyUsage extends Model
{
    use HasUlids;

    protected $table = 'api_key_usages';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = null;
    const UPDATED_AT = null;

    protected $fillable = ['keyId', 'day', 'count'];

    protected $casts = ['count' => 'integer'];

    public function key(): BelongsTo
    {
        return $this->belongsTo(ApiKey::class, 'keyId');
    }
}
