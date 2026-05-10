# Wiring and Pin Map — UNO R4 WiFi (DHT11 + LDR + LEDs)

Overview
- Board: Arduino UNO R4 WiFi
- Sensors: DHT11 (temperature + humidity), Photoresistor (LDR)
- Indicators: Yellow LED (day), Blue LED (night), Red LED (hot)

Pin connections
- DHT11:
  - VCC -> `5V`
  - DATA -> `D2` (digital) (use 10kΩ pull-up from DATA to VCC)
  - GND -> `GND`

- Photoresistor (LDR):
  - One side of LDR -> `A0`
  - Other side of LDR -> `GND`
  - Add a pull-up resistor (10kΩ) from `A0` to `5V` (voltage divider)

- LEDs (all through ~220Ω resistors):
  - Yellow LED anode -> `D4`; cathode -> `GND` via resistor
  - Blue LED anode -> `D5`; cathode -> `GND` via resistor
  - Red LED anode -> `D6`; cathode -> `GND` via resistor

Notes and tips
- Use a common ground between sensors and the board.
- DHT11 timing: allow ~2 seconds after power before the first read.
- LDR reading range: analogRead returns 0–1023; tune `LIGHT_THRESHOLD` in the sketch to match your environment (500 is a sensible start).
- If using breadboard wiring, keep long wires short for the DHT data line to reduce noise.

ASCII diagram (simplified)

  [5V] -----+------------------+-----------------
            |                  |                
         10kΩ pull-up         DHT11 VCC         
            |                  |                
           A0 (voltage) <--- LDR --- GND        
            |                                   
           ADC reads light level                

  D2 ----> DHT11 DATA (10k pull-up to 5V)
  D4 ----> Yellow LED (+) -- 220Ω -- GND (-)
  D5 ----> Blue LED   (+) -- 220Ω -- GND (-)
  D6 ----> Red LED    (+) -- 220Ω -- GND (-)
