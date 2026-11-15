import random
import time


class AstronautTelemetry:
    def __init__(self):
        self.heart_rate = 72
        self.respiration_rate = 15
        self.temperature = 36.7
        self.oxygen_saturation = 98
        self.activity = 30
        
        self.mode = "NORMAL"
    
    def set_mode(self, mode:str):
        allowed_modes = {
            "NORMAL",
            "WORKLOAD",
            "HEALTH_DEVIATION"
        }
        
        if mode not in allowed_modes:
            raise ValueError(
                f"Invalid Mode: {mode}"
            )
        self.mode = mode
        
    def generate(self):
        
        if self.mode == "NORMAL":
            target_hr = 72
            target_activity = 30
            target_temp = 37.9
            target_spo2 = 98.5
            resp_ratio = 4.5  # ~16 breaths/min at 72bpm
            
        elif self.mode == "WORKLOAD":
            target_hr = 115
            target_activity = 80
            target_temp = 38.8
            target_spo2 = 97.5
            resp_ratio = 4.2 # Faster breathing under phyiscal load
        
        else: #Health Deviation
            target_hr = 110
            target_activity = 10
            target_temp = 39.8
            target_spo2 = 93.0
            resp_ratio = 4.0 # Rapid, shallow breathing
            
        self.activity += (target_activity - self.activity) * 0.15 + random.uniform(-2, 2)
        self.heart_rate += (target_hr - self.heart_rate) * 0.15 + random.uniform(-1.5, 1.5)
        
        #Respiration rate coupled directly to current heart rate
        target_resp = self.heart_rate / resp_ratio
        self.respiration_rate += (target_resp - self.respiration_rate) * 0.2 + random.uniform(-0.4, 0.4)
        
        
        # Temperature changes slowly
        self.temperature += (target_temp - self.temperature) * 0.04 + random.uniform(-0.02, 0.02)
            
        self.oxygen_saturation += (target_spo2 - self.oxygen_saturation) * 0.1 + random.uniform(-0.1, 0.1)
        self.oxygen_saturation = min(100.0, self.oxygen_saturation)

        return {
            "timestamp": time.time(),
            "heart_rate": round(self.heart_rate, 2),
            "respiration_rate": round(self.respiration_rate, 2),
            "temperature": round(self.temperature, 2),
            "oxygen_saturation": round(self.oxygen_saturation, 2),
            "activity": round(self.activity, 2),
            "mode": self.mode,
        }