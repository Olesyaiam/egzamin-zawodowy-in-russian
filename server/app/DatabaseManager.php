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

        foreach ($cacheAndTime['index'] as $flowerName => $dataKey) {
            if (stripos($polishTextLower, $flowerName) !== false) {
                $regex = '/(?<![\p{L}\d])' . preg_quote($flowerName, '/') . '(?![\p{L}\d])/ui';

                if (preg_match($regex, $polishTextLower)) {
                    $results['flowers'][$flowerName] = array(
                        'ru' => $cacheAndTime['data'][$dataKey][0],
                        'wiki_pl' => 'https://pl.wikipedia.org/wiki/' . $cacheAndTime['data'][$dataKey][1],
                        'img' => $cacheAndTime['data'][$dataKey][2] ? self::IMAGES_BASE_URL . $cacheAndTime['data'][$dataKey][2] : null
                    );

                    $polishTextLower = preg_replace($regex, '', $polishTextLower);
                }
            }
        }

        $results['time_file'] = $cacheAndTime[1];
        $results['time_search'] = round(microtime(true) - $searchStartTime, 2);

        return $results;
    }

    private function generateCache(): array
    {
        $startTime = microtime(true);
        $flowers = $this->load();
        $data = array();
        $index = array();

        foreach ($flowers as $latinFlowerName => $flowerInfo) {
            $data[] = array(
                $flowerInfo['ru'],
                $flowerInfo['pl_wiki'],
                array_key_exists('our_img', $flowerInfo) ? $flowerInfo['our_img'] : null
            );

            $dataKey = count($data) - 1;
            $index[$latinFlowerName] = $dataKey;
            $polishFlowerNames = array_key_exists('pl_more', $flowerInfo) ? $flowerInfo['pl_more'] : array();
            $polishFlowerNames[] = $flowerInfo['pl'];

            foreach ($polishFlowerNames as $polishFlowerName) {
                if ($polishFlowerName != $latinFlowerName) {
                    $index[$polishFlowerName] = $dataKey;
                }
            }
        }

        uksort($index, function ($a, $b) {
            return strlen($b) - strlen($a);
        });

        $caches = array(
            'data' => $data,
            'index' => $index
        );

        file_put_contents(
            $this->storagePath . '/' . $this->filenameCache,
            json_encode($caches, JSON_UNESCAPED_UNICODE)
        );

        $caches['time'] = round(microtime(true) - $startTime, 2);

        return $caches;
    }

    private function loadCacheGenerateIfNotExists(): array
    {
        $cache = $this->load($this->filenameCache);

        return $cache ? $cache : $this->generateCache();
    }
}
