<?php
/**
 * Socia Visual — Global Stats API
 * Stores aggregated stats from all users in a JSON file.
 * Deploy alongside index.html on sociavisual.com
 */

// CORS headers for same-site and local dev
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$STATS_FILE = __DIR__ . '/stats_data.json';

// Default stats structure
$defaults = [
    'visits'       => 0,
    'pulses'       => 0,
    'trail'        => 0,
    'wins'         => 0,
    'freqs'        => 0,
    'distance'     => 0,
    'time'         => 0,
    'achievements' => 0,
    'sessions'     => 0,
    'topSpeed'     => 0,
    'mxRaces'      => 0,
    'mxBestTime'   => 0,
    'wr_DUST BOWL' => 0,
    'wr_GLACIER RUN' => 0,
    'wr_NEON CITY' => 0,
    'lastUpdated'  => time()
];

function loadStats($file, $defaults) {
    if (!file_exists($file)) {
        return $defaults;
    }
    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data)) return $defaults;
    return array_merge($defaults, $data);
}

function saveStats($file, $stats) {
    $stats['lastUpdated'] = time();
    file_put_contents($file, json_encode($stats), LOCK_EX);
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {

    // Return current global stats
    case 'get':
        $stats = loadStats($STATS_FILE, $defaults);
        echo json_encode($stats);
        break;

    // Record a new visit
    case 'visit':
        $stats = loadStats($STATS_FILE, $defaults);
        $stats['visits']++;
        $stats['sessions']++;
        saveStats($STATS_FILE, $stats);
        echo json_encode(['ok' => true]);
        break;

    // Push session stats (called via sendBeacon on page unload)
    case 'push':
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid data']);
            break;
        }
        $stats = loadStats($STATS_FILE, $defaults);

        // Accumulate session totals
        $stats['pulses']       += max(0, intval($data['pulses'] ?? 0));
        $stats['trail']        += max(0, intval($data['trail'] ?? 0));
        $stats['wins']         += max(0, intval($data['wins'] ?? 0));
        $stats['freqs']        += max(0, intval($data['freqs'] ?? 0));
        $stats['distance']     += max(0, intval($data['distance'] ?? 0));
        $stats['time']         += max(0, intval($data['time'] ?? 0));
        $stats['achievements'] += max(0, intval($data['achievements'] ?? 0));

        // Track top speed (highest ever)
        $speed = intval($data['topSpeed'] ?? 0);
        if ($speed > $stats['topSpeed']) {
            $stats['topSpeed'] = $speed;
        }

        // Motocross stats
        $stats['mxRaces'] += max(0, intval($data['mxRaces'] ?? 0));
        $mxTime = floatval($data['mxBestTime'] ?? 0);
        if ($mxTime > 0 && ($stats['mxBestTime'] == 0 || $mxTime < $stats['mxBestTime'])) {
            $stats['mxBestTime'] = $mxTime;
        }

        // World records per track (lowest lap time wins)
        $wrKeys = ['wr_DUST BOWL', 'wr_GLACIER RUN', 'wr_NEON CITY'];
        foreach ($wrKeys as $wrKey) {
            $wrTime = floatval($data[$wrKey] ?? 0);
            if ($wrTime > 0) {
                if (!isset($stats[$wrKey]) || $stats[$wrKey] == 0 || $wrTime < $stats[$wrKey]) {
                    $stats[$wrKey] = $wrTime;
                }
            }
        }

        saveStats($STATS_FILE, $stats);
        echo json_encode(['ok' => true]);
        break;

    // Correct a specific stat value (one-time fix tool)
    case 'fix':
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid data']);
            break;
        }
        $stats = loadStats($STATS_FILE, $defaults);
        foreach ($data as $key => $val) {
            if (array_key_exists($key, $stats) && $key !== 'lastUpdated') {
                $stats[$key] = is_float($val + 0) ? floatval($val) : intval($val);
            }
        }
        saveStats($STATS_FILE, $stats);
        echo json_encode(['ok' => true, 'stats' => $stats]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action. Use: get, visit, push, fix']);
        break;
}
