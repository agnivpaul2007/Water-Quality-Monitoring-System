#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>

struct SensorData
{
  float pH;
  float temperature;
  float turbidity;
  float TDS;
};
SensorData data;

int pH_sensorPin = A2;
int temperature_sensorPin = 2;
int turbidity_sensorPin = A0;
int tds_sensorPin = A1;

OneWire oneWire(temperature_sensorPin);
DallasTemperature tempSensor(&oneWire);

void setup()
{
  Serial.begin(9600);
  tempSensor.begin();
  pinMode(pH_sensorPin, INPUT);
  pinMode(turbidity_sensorPin, INPUT);
  pinMode(tds_sensorPin, INPUT);
}

float phConversion(float voltage)
{
  float pH = map(voltage, 0, 1023, 0, 14);
  return pH;
}

float turbidityConversion(float voltage)
{
  float turbidity = map(voltage, 0, 640, 100, 0) - 75;
  return turbidity;
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
  data.pH = phConversion(analogRead(pH_sensorPin));
  Serial.print(F("{\"pH\":"));
  Serial.print(data.pH, 2);
  Serial.print(F(",\"temperature\":"));
  Serial.print(data.temperature, 2);
  Serial.print(F(",\"turbidity\":"));
  Serial.print(data.turbidity, 2);
  Serial.print(F(",\"tds\":"));
  Serial.print(data.TDS, 2);
  Serial.println(F("}"));
  delay(1000);
}
