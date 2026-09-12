#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>

struct SensorData
{
  float temperature;
  float turbidity;
  float TDS;
};
SensorData data;

int temperature_sensorPin = 2;
int turbidity_sensorPin = A0;
int tds_sensorPin = A1;

OneWire oneWire(temperature_sensorPin);
DallasTemperature tempSensor(&oneWire);

void setup()
{
  Serial.begin(9600);
  tempSensor.begin();
  pinMode(turbidity_sensorPin, INPUT);
  pinMode(tds_sensorPin, INPUT);
}

float turbidityConversion(float voltage)
{
  float turbudity = map(voltage, 0, 640, 100, 0) - 75;
  return turbudity;
}

float tdsConversion(float voltage)
{
  float tds = map(voltage, 0, 1023, 0, 1000);
  return tds;
}


void loop()
{
  tempSensor.requestTemperatures();
  data.temperature = tempSensor.getTempCByIndex(0);
  data.turbidity = turbidityConversion(analogRead(turbidity_sensorPin));
  data.TDS = tdsConversion(analogRead(tds_sensorPin));
  Serial.print(F("{\"pH\":"));
  Serial.print("0");
  Serial.print(F(",\"temperature\":"));
  Serial.print(data.temperature, 2);
  Serial.print(F(",\"turbidity\":"));
  Serial.print(data.turbidity, 2);
  Serial.print(F(",\"tds\":"));
  Serial.print(data.TDS, 2);
  Serial.println(F("}"));
  delay(1000);
}
