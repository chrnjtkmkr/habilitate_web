import os
import soundfile as sf
import numpy as np

OUTPUT_DIR = "./dataset"
CATEGORIES = ["adult_speech", "child_speech", "therapy_noises", "silence_ambient"]

# Create dataset directory structure
for cat in CATEGORIES:
    os.makedirs(f"{OUTPUT_DIR}/{cat}", exist_ok=True)

def generate_silence_slices(sr=16000, duration_sec=60):
    """Generates 1-second quiet ambient/silence WAV clips."""
    samples_per_slice = sr
    total_samples = sr * duration_sec
    quiet_noise = np.random.normal(0, 0.001, total_samples)
    
    slice_count = 0
    for i in range(0, total_samples - samples_per_slice, samples_per_slice):
        chunk = quiet_noise[i : i + samples_per_slice]
        file_path = os.path.join(OUTPUT_DIR, "silence_ambient", f"generated_silence_{slice_count}.wav")
        sf.write(file_path, chunk, sr)
        slice_count += 1
    print(f"Created {slice_count} 1-second silence clips in 'silence_ambient'.")

print("--- Preparing Dataset Folders ---")
generate_silence_slices()

print("\nFolders are ready at E:\\habilitate-main\\dataset\\")
print("1. Place adult voice .wav files in: ./dataset/adult_speech")
print("2. Place child voice .wav files in: ./dataset/child_speech")
print("3. Place noise .wav files (knocks, chair scrapes) in: ./dataset/therapy_noises")