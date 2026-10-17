<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasUlids;

    protected $table = 'plans';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = null;
    const UPDATED_AT = null;

    protected $fillable = [
        'name', 'slug', 'description', 'priceUsd', 'credits', 'monitorLimit',
        'features', 'badge', 'active', 'sortOrder',
    ];

    protected $casts = [
        'priceUsd' => 'float',
        'credits' => 'integer',
        'monitorLimit' => 'integer',
        'active' => 'boolean',
        'sortOrder' => 'integer',
    ];

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'planId');
    }
}
