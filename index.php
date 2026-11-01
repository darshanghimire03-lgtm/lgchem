<?php
$host = getenv('DB_HOST');
$user = getenv('DB_USER');
$pass = getenv('DB_PASS');
$name = getenv('DB_NAME');

echo "<h1>It works</h1>";
echo "<p>PHP " . phpversion() . "</p>";

if ($host) {
    mysqli_report(MYSQLI_REPORT_OFF);
    $db = @new mysqli($host, $user, $pass, $name);
    echo $db->connect_errno ? "<p>DB failed: " . htmlspecialchars($db->connect_error) . "</p>" : "<p>DB connected</p>";
} else {
    echo "<p>No DB configured</p>";
}