<?php

namespace App;

class Base
{
    protected string $filename = '';
    protected $storagePath;

    public function __construct()
    {
        $this->storagePath = app()->storagePath();
    }

    /**
     * Если путь абсолютный (начинается с '/'), возвращаем как есть.
     * Если относительный — склеиваем со storagePath.
     */
    protected function resolvePath(?string $name = null): string
    {
        $name = $name ?? $this->filename;

        if ($name === null || $name === '') {
            return $this->storagePath . '/';
        }

        if ($name[0] === '/') {
            return $name; // абсолютный путь
        }

        return $this->storagePath . '/' . $name;
    }

    protected function load(string $filename = null)
    {
        $path = $this->resolvePath($filename);

        if (file_exists($path)) {
            return json_decode(file_get_contents($path), true) ?: [];
        }

        return [];
    }

    protected function save($data): bool
    {
        $path = $this->resolvePath($this->filename);
        $dir = dirname($path);

        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }

        return (bool) file_put_contents(
            $path,
            json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }
}
