<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class GatewayConfig extends Model
{
    use HasUlids;

    protected $table = 'gateway_configs';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = null;
    const UPDATED_AT = null;

    protected $fillable = ['code', 'name', 'logo', 'enabled', 'mode', 'instructions', 'config', 'sortOrder'];

    protected $casts = ['enabled' => 'boolean', 'sortOrder' => 'integer'];
}
