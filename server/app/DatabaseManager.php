<?php

namespace App;

class DatabaseManager extends Base
{
    protected string $filename = 'flowers.json';
    protected string $filenameCache = 'flowers_cache.json';
    protected const IMAGES_BASE_URL = 'https://raw.githubusercontent.com/Olesyaiam/egzamin-zawodowy-in-russian/main/server/public/images/flowers/';

    public function findFlowerImages($polishText)
    {
        $results = array();
        $cache = $this->loadCacheGenerateIfNotExists();

        foreach ($cache as $flowerName => $imageFilename) {
            if (stripos($polishText, $flowerName) !== false) {
                $results[$flowerName] = self::IMAGES_BASE_URL . $imageFilename;
                $polishText = str_ireplace($flowerName, '', $polishText);
            }
        }

        return $results;
    }

    private function generateCache(): array
    {
        $flowers = $this->load();
        $cache = array();

        foreach ($flowers as $flowerInfo) {
            if (array_key_exists('our_img', $flowerInfo) && $flowerInfo['our_img']) {
                $words = array_key_exists('pl_more', $flowerInfo) ? $flowerInfo['pl_more'] : array();
                $words[] = $flowerInfo['pl'];

                foreach ($words as $word) {
                    $cache[$word] = $flowerInfo['our_img'];
                }
            }
        }

        uksort($cache, function ($a, $b) {
            return strlen($b) - strlen($a);
        });

        file_put_contents($this->storagePath . '/' . $filename, json_encode($cache), JSON_UNESCAPED_UNICODE);

        return $cache;
    }

    private function loadCacheGenerateIfNotExists(): array
    {
        $cache = $this->load($this->filenameCache);

        return count($cache) > 0 ? $cache : $this->generateCache();
    }
}
