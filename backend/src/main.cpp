#include <Arduino.h>

struct SensorData
{
  float pH;
  float temperature;
  float TDS;
  float turbidity;
};
SensorData data;

int pH_sensorPin = A0;
int temperature_sensorPin = A1;
int TDS_sensorPin = A2;
int turbidity_sensorPin = A3;

void setup()
{
  Serial.begin(9600);
  pinMode(pH_sensorPin, INPUT);
  pinMode(turbidity_sensorPin, INPUT);
  pinMode(temperature_sensorPin, INPUT);
  pinMode(TDS_sensorPin, INPUT);
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
  data.pH = phConversion(readSensor(pH_sensorPin));
  data.temperature = temperatureConversion(readSensor(temperature_sensorPin));
  data.TDS = TDSConversion(readSensor(TDS_sensorPin));
  data.turbidity = turbidityConversion(readSensor(turbidity_sensorPin));

  Serial.write((uint8_t *)&data, sizeof(data));
  delay(1000);
}
