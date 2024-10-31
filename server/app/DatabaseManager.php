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
        $cacheAndTime = $this->loadCacheGenerateIfNotExists();
        $startTime = microtime(true);
        $polishTextLower = mb_strtolower($polishText);

        foreach ($cacheAndTime[0] as $flowerName => $imageFilename) {
            if (stripos($polishTextLower, $flowerName) !== false) {
                $results[$flowerName] = self::IMAGES_BASE_URL . $imageFilename;
                $polishTextLower = str_ireplace($flowerName, '', $polishTextLower);
            }
        }

        return array($results, $cacheAndTime[1], round(microtime(true) - $startTime, 2));
    }

    private function generateCache(): array
    {
        $flowers = $this->load();
        $cache = array();

        foreach ($flowers as $flowerNameLatin => $flowerInfo) {
            if (array_key_exists('our_img', $flowerInfo) && $flowerInfo['our_img']) {
                $cache[$flowerNameLatin] = $flowerInfo['our_img'];
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

        file_put_contents(
            $this->storagePath . '/' . $this->filenameCache,
            json_encode($cache),
            JSON_UNESCAPED_UNICODE
        );

        return $cache;
    }

    private function loadCacheGenerateIfNotExists(): array
    {
        $startTime = microtime(true);
        $cache = $this->load($this->filenameCache);

        return array(
            count($cache) > 0 ? $cache : $this->generateCache(),
            round(microtime(true) - $startTime, 2)
        );
    }
}
