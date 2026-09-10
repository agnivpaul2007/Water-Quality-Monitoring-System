#include <Arduino.h>

struct SensorData
{
  float temperature;
  float turbidity;
};
SensorData data;

int temperature_sensorPin = D2;
int turbidity_sensorPin = A0;

void setup()
{
  Serial.begin(9600);
  pinMode(turbidity_sensorPin, INPUT);
  pinMode(temperature_sensorPin, INPUT);
}

float analogreadSensor(int pin)
{
  int sensorValue = analogRead(pin);
  float voltage = sensorValue * (5.0 / 1023.0);
  return voltage;
}
float digitalreadSensor(int pin)
{
  int sensorValue = digitalRead(pin);
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
float TDSConversion(float voltage)
{
  return voltage * 20.0; // Example conversion for TDS sensor
}
float turbidityConversion(float voltage)
{
  return voltage * 100.0; // Example conversion for turbidity sensor
}


void loop()
{
  data.temperature = temperatureConversion(analogreadSensor(temperature_sensorPin));
  data.turbidity = turbidityConversion(digitalreadSensor(turbidity_sensorPin));

  Serial.write((uint8_t *)&data, sizeof(data));
  delay(1000);
}
