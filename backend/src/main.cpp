#include <Arduino.h>

struct SensorData
{
  float pH;
  float temperature;
  float dissolvedOxygen;
  float turbidity;
  float conductivity;
};
SensorData data;

int pH_sensorPin = A0;
int temperature_sensorPin = A1;
int dissolvedOxygen_sensorPin = A2;
int turbidity_sensorPin = A3;
int conductivity_sensorPin = A4;

void setup()
{
  Serial.begin(9600);
  pinMode(pH_sensorPin, INPUT);
  pinMode(turbidity_sensorPin, INPUT);
  pinMode(temperature_sensorPin, INPUT);
  pinMode(conductivity_sensorPin, INPUT);
  pinMode(dissolvedOxygen_sensorPin, INPUT);
}

float readSensor(int pin)
{
  int sensorValue = analogRead(pin);
  float voltage = sensorValue * (5.0 / 1023.0);
  return voltage;
}

float phConversion(float voltage)
{
  return (voltage - 2.5) * 3.0; // Example conversion for pH sensor
}

float temperatureConversion(float voltage)
{
  return (voltage - 0.5) * 100.0; // Example conversion for temperature sensor
}
float dissolvedOxygenConversion(float voltage)
{
  return voltage * 20.0; // Example conversion for dissolved oxygen sensor
}
float turbidityConversion(float voltage)
{
  return voltage * 100.0; // Example conversion for turbidity sensor
}
float conductivityConversion(float voltage)
{
  return voltage * 1000.0; // Example conversion for conductivity sensor
}

void loop()
{
  data.pH = phConversion(readSensor(pH_sensorPin));
  data.temperature = temperatureConversion(readSensor(temperature_sensorPin));
  data.dissolvedOxygen = dissolvedOxygenConversion(readSensor(dissolvedOxygen_sensorPin));
  data.turbidity = turbidityConversion(readSensor(turbidity_sensorPin));
  data.conductivity = conductivityConversion(readSensor(conductivity_sensorPin));

  Serial.write((uint8_t *)&data, sizeof(data));
  delay(1000);
}
