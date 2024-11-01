<?php

namespace App;

class DatabaseManager extends Base
{
    protected string $filename = 'flowers.json';
    protected string $filenameCache = 'flowers_cache.json';
    protected const IMAGES_BASE_URL = 'https://raw.githubusercontent.com/Olesyaiam/egzamin-zawodowy-in-russian/main/server/public/images/flowers/';

    public function findFlowers($polishText)
    {
        $results = array('flowers' => array());
        $cacheAndTime = $this->loadCacheGenerateIfNotExists();
        $searchStartTime = microtime(true);
        $polishTextLower = mb_strtolower($polishText);

        foreach ($cacheAndTime[0] as $flowerName => $flowerShortInfo) {
            if (stripos($polishTextLower, $flowerName) !== false) {
                $results['flowers'][$flowerName] = array(
                    'ru' => $flowerShortInfo[0],
                    'wiki_pl' => 'https://pl.wikipedia.org/wiki/' . $flowerShortInfo[1],
                    'img' => $flowerShortInfo[$flowerName][2] ? self::IMAGES_BASE_URL . $flowerShortInfo[2] : null
                );

                $polishTextLower = str_ireplace($flowerName, '', $polishTextLower);
            }
        }

        $results['time_file'] = $cacheAndTime[1];
        $results['time_search'] = round(microtime(true) - $searchStartTime, 2);

        return $results;
    }

    private function generateCache(): array
    {
        $flowers = $this->load();
        $cache = array();

        foreach ($flowers as $flowerNameLatin => $flowerInfo) {
            $cache[$flowerNameLatin] = array(
                $flowerInfo['ru'],
                $flowerInfo['pl_wiki'],
                array_key_exists('our_img', $flowerInfo) ? $flowerInfo['our_img'] : null
            );

            $polishFlowerNames = array_key_exists('pl_more', $flowerInfo) ? $flowerInfo['pl_more'] : array();
            $polishFlowerNames[] = $flowerInfo['pl'];

            foreach ($polishFlowerNames as $polishFlowerName) {
                if ($polishFlowerName != $flowerNameLatin) {
                    $cache[$polishFlowerName] = $cache[$flowerNameLatin];
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
