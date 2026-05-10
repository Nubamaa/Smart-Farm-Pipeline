// ============================================================
// Smart Farm Node - Secure MQTT + Deep Sleep
// Sensor : DHT11 + Photoresistor
// LEDs   : Yellow (Day) | Blue (Night) | Red (Hot Temp)
// Board  : Arduino UNO R4 WiFi
// Phase 1: MQTTS (port 8883) + WiFiSSLClient
// Phase 2: Wake -> Publish -> Sleep cycle
// ============================================================

#include <WiFiS3.h>
#include "Adafruit_MQTT.h"
#include "Adafruit_MQTT_Client.h"
#include <DHT.h>

#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASS "YOUR_WIFI_PASSWORD"

#define AIO_SERVER "io.adafruit.com"
#define AIO_SERVERPORT 8883
#define AIO_USERNAME "YOUR_AIO_USERNAME"
#define AIO_KEY "YOUR_AIO_KEY"

#define NODE_ID "node-a"

#define DHT_PIN 2
#define DHT_TYPE DHT11
#define LED_YELLOW 4
#define LED_BLUE 5
#define LED_RED 6
#define LDR_PIN A0

#define LIGHT_THRESHOLD 500
#define TEMP_HOT 35

DHT dht(DHT_PIN, DHT_TYPE);
WiFiSSLClient sslClient;
Adafruit_MQTT_Client mqtt(&sslClient, AIO_SERVER, AIO_SERVERPORT, AIO_USERNAME, AIO_KEY);

Adafruit_MQTT_Publish tempFeed(&mqtt, AIO_USERNAME "/feeds/" NODE_ID ".temperature");
Adafruit_MQTT_Publish humFeed(&mqtt, AIO_USERNAME "/feeds/" NODE_ID ".humidity");
Adafruit_MQTT_Publish lightFeed(&mqtt, AIO_USERNAME "/feeds/" NODE_ID ".light");

#define SLEEP_MINUTES 15
#define SLEEP_MS (SLEEP_MINUTES * 60UL * 1000UL)

void connectWiFi();
void connectMQTT();
void allLedsOff();

void setup() {
  Serial.begin(9600);
  while (!Serial && millis() < 3000) {
  }

  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  allLedsOff();

  dht.begin();
  connectWiFi();
}

void loop() {
  connectMQTT();

  const int lightValue = analogRead(LDR_PIN);
  const bool isDay = lightValue > LIGHT_THRESHOLD;

  Serial.print("[LIGHT] Raw value: ");
  Serial.print(lightValue);
  Serial.print(" -> ");
  Serial.println(isDay ? "DAYTIME" : "NIGHTTIME");

  if (isDay) {
    digitalWrite(LED_YELLOW, HIGH);
    digitalWrite(LED_BLUE, LOW);
    Serial.println("[LED] Yellow ON (day detected)");
  } else {
    digitalWrite(LED_YELLOW, LOW);
    digitalWrite(LED_BLUE, HIGH);
    Serial.println("[LED] Blue ON (night detected)");
  }

  delay(2000);

  const float temperature = dht.readTemperature();
  const float humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("[ERROR] Failed to read DHT11");
    digitalWrite(LED_RED, LOW);
  } else {
    Serial.print("[SENSOR] Temp: ");
    Serial.print(temperature);
    Serial.print(" C | Humidity: ");
    Serial.print(humidity);
    Serial.println(" %");

    if (temperature >= TEMP_HOT) {
      digitalWrite(LED_RED, HIGH);
      Serial.println("[LED] Red ON - temperature too high!");
    } else {
      digitalWrite(LED_RED, LOW);
      Serial.println("[LED] Red OFF - temperature normal");
    }

    const bool tempOK = tempFeed.publish(temperature);
    const bool humOK = humFeed.publish(humidity);
    const bool lightOK = lightFeed.publish(lightValue);

    if (tempOK && humOK && lightOK) {
      Serial.println("[MQTT] All feeds published via MQTTS port 8883.");
    } else {
      Serial.println("[MQTT] One or more feeds failed - will retry next cycle.");
    }
  }

  Serial.println("[POWER] Turning off LEDs before sleep...");
  allLedsOff();

  Serial.println("[POWER] Disconnecting from MQTT broker...");
  mqtt.disconnect();

  Serial.println("[POWER] Turning off Wi-Fi radio...");
  WiFi.disconnect();
  WiFi.end();

  Serial.print("[POWER] Sleeping for ");
  Serial.print(SLEEP_MINUTES);
  Serial.println(" minutes...");

  delay(SLEEP_MS);
  Serial.println("[POWER] Waking up...");
  connectWiFi();
}

void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print('.');
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[WiFi] Connected");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("[WiFi] Connection failed");
  }
}

void connectMQTT() {
  if (mqtt.connected()) {
    return;
  }

  int8_t result;
  uint8_t retries = 3;

  while ((result = mqtt.connect()) != 0 && retries--) {
    Serial.println(mqtt.connectErrorString(result));
    mqtt.disconnect();
    delay(5000);
  }

  if (result == 0) {
    Serial.println("[MQTT] Connected securely");
  } else {
    Serial.println("[MQTT] Could not connect");
  }
}

void allLedsOff() {
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_BLUE, LOW);
  digitalWrite(LED_RED, LOW);
}
