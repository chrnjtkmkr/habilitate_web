import os
import numpy as np
import scipy.io.wavfile as wav

OUTPUT_DIR = "./dataset"
SAMPLE_RATE = 16000  # 16kHz audio standard for Edge Impulse
DURATION = 1.0       # 1-second clips
SAMPLES = int(SAMPLE_RATE * DURATION)
TARGET_COUNT = 100

def ensure_dirs():
    categories = ["adult_speech", "child_speech", "therapy_noises", "silence_ambient"]
    for cat in categories:
        os.makedirs(os.path.join(OUTPUT_DIR, cat), exist_ok=True)

def generate_adult_speech(count=100):
    print(f"[1/3] Generating {count} Adult Speech audio samples...")
    np.random.seed(42)
    for idx in range(count):
        t = np.linspace(0, DURATION, SAMPLES, False)
        # Fundamental frequency (f0) range for adult speech: 85 - 180 Hz
        f0 = np.random.uniform(85, 180)
        
        # Formant frequencies for adult speech vowels
        f1, f2 = np.random.uniform(300, 800), np.random.uniform(900, 2300)
        
        # Synthesize harmonic vocal source
        signal = np.sin(2 * np.pi * f0 * t) + 0.5 * np.sin(2 * np.pi * 2 * f0 * t)
        signal += 0.3 * np.sin(2 * np.pi * f1 * t) + 0.2 * np.sin(2 * np.pi * f2 * t)
        
        # Speech envelope simulation (syllable rhythms)
        envelope = np.sin(np.pi * np.linspace(0, 1, SAMPLES)) ** 2
        speech = signal * envelope * 0.6
        
        # Normalize to int16 PCM
        audio_int16 = (speech / np.max(np.abs(speech)) * 32767).astype(np.int16)
        file_path = os.path.join(OUTPUT_DIR, "adult_speech", f"adult_{idx}.wav")
        wav.write(file_path, SAMPLE_RATE, audio_int16)

def generate_child_speech(count=100):
    print(f"[2/3] Generating {count} Child Speech audio samples...")
    np.random.seed(101)
    for idx in range(count):
        t = np.linspace(0, DURATION, SAMPLES, False)
        # Higher pitch fundamental frequency (f0) for child speech: 250 - 450 Hz
        f0 = np.random.uniform(250, 450)
        
        # Higher shifted formants
        f1, f2 = np.random.uniform(600, 1200), np.random.uniform(2200, 3500)
        
        signal = np.sin(2 * np.pi * f0 * t) + 0.6 * np.sin(2 * np.pi * 1.5 * f0 * t)
        signal += 0.4 * np.sin(2 * np.pi * f1 * t) + 0.3 * np.sin(2 * np.pi * f2 * t)
        
        envelope = np.sin(np.pi * np.linspace(0, 1, SAMPLES) ** 0.8) ** 2
        speech = signal * envelope * 0.6
        
        audio_int16 = (speech / np.max(np.abs(speech)) * 32767).astype(np.int16)
        file_path = os.path.join(OUTPUT_DIR, "child_speech", f"child_{idx}.wav")
        wav.write(file_path, SAMPLE_RATE, audio_int16)

def generate_therapy_noises(count=100):
    print(f"[3/3] Generating {count} Therapy Room Noise samples...")
    np.random.seed(202)
    for idx in range(count):
        t = np.linspace(0, DURATION, SAMPLES, False)
        noise_type = idx % 3
        
        if noise_type == 0:
            # Impact transients (door knock, item dropped)
            signal = np.random.normal(0, 0.1, SAMPLES)
            decay = np.exp(-t * np.random.uniform(15, 30))
            noise = signal * decay
        elif noise_type == 1:
            # Chair scrape or table motion (filtered transient burst)
            freq = np.random.uniform(800, 2500)
            signal = np.sin(2 * np.pi * freq * t) * np.random.normal(0.5, 0.2, SAMPLES)
            envelope = np.where((t > 0.2) & (t < 0.6), 1.0, 0.05)
            noise = signal * envelope
        else:
            # Click / toy movement (short impulses)
            noise = np.zeros(SAMPLES)
            pos = np.random.randint(2000, 14000)
            noise[pos:pos+300] = np.random.uniform(-0.8, 0.8, 300)
        
        # Max scaling protection
        max_val = np.max(np.abs(noise))
        if max_val > 0:
            noise = noise / max_val * 0.5
            
        audio_int16 = (noise * 32767).astype(np.int16)
        file_path = os.path.join(OUTPUT_DIR, "therapy_noises", f"noise_{idx}.wav")
        wav.write(file_path, SAMPLE_RATE, audio_int16)

if __name__ == "__main__":
    ensure_dirs()
    generate_adult_speech(TARGET_COUNT)
    generate_child_speech(TARGET_COUNT)
    generate_therapy_noises(TARGET_COUNT)
    print("\nDataset ready! All 4 categories populated in './dataset/'.")