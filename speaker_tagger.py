#!/usr/bin/env python
"""
================================================================================
speaker_tagger.py: Speaker Segmentation and Clustering for PerfectTranscribe using
inaSpeechSegmenter and MFCC-based embeddings with gender-aware clustering
================================================================================

This module performs speech segmentation using inaSpeechSegmenter with automatic
speaker detection, then applies speaker clustering based on vector similarity. It
extracts audio (if needed) from a video file, computes speaker embeddings for each
segment using MFCC features from librosa (mean and std of 40 MFCCs), then separates
segments by detected gender (male, female, or unknown). Each group is clustered
(using a cosine distance threshold of 0.10) and finally, speaker labels are reassigned
in chronological order (based on the first appearance of each speaker cluster).

Usage:
    python speaker_tagger.py <input_file> <output_file>
================================================================================
"""

import sys
import subprocess
from pathlib import Path
from typing import Optional
import numpy as np
import librosa
from inaSpeechSegmenter import Segmenter
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_distances
import diarizer_core_types

# --- Constants & Configuration ---
AUDIO_CACHE_FOLDER = Path("./audio_cache")
FRAME_DURATION = 0.05  # seconds per frame

# --- Logging Function ---
def _log(message: str):
    print(f"[DEBUG SpeakerTagger] {message}")

# --- Audio Extraction Helper ---
def extract_audio(file_path: Path) -> Path:
    if file_path.suffix.lower() in ['.wav', '.mp3']:
        _log(f"Input file {file_path} is already an audio file.")
        return file_path
    if not AUDIO_CACHE_FOLDER.exists():
        AUDIO_CACHE_FOLDER.mkdir(parents=True, exist_ok=True)
    audio_output_path = AUDIO_CACHE_FOLDER / (file_path.stem + "_audio_16k.wav")
    _log(f"Extracting audio from {file_path} to {audio_output_path}...")
    command = [
        "ffmpeg", "-y", "-i", str(file_path),
        "-vn", "-acodec", "pcm_s16le", "-ac", "1", "-ar", "16000",
        "-hide_banner", "-loglevel", "error", str(audio_output_path)
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        _log(f"[ERROR] FFmpeg extraction failed with code {result.returncode}.")
        if audio_output_path.exists():
            audio_output_path.unlink()
        sys.exit(1)
    _log(f"Audio extracted to {audio_output_path}.")
    return audio_output_path

# --- convert_to_mp4 function ---
def convert_to_mp4(input_path: Path) -> Optional[Path]:
    output_path = input_path.parent / (input_path.stem + "_converted.mp4")
    _log(f"Converting {input_path} to MP4: {output_path}")
    command = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-c:v", "copy", "-c:a", "copy",
        "-hide_banner", "-loglevel", "error", str(output_path)
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode == 0:
        _log(f"[SUCCESS] Fast copy conversion completed: {output_path}")
        return output_path
    else:
        _log("[WARN] Fast copy conversion failed; attempting re-encoding...")
        command_reencode = [
            "ffmpeg", "-y", "-i", str(input_path),
            "-c:v", "libx264", "-crf", "23", "-preset", "fast",
            "-c:a", "aac", "-b:a", "128k",
            "-hide_banner", "-loglevel", "error", str(output_path)
        ]
        result_reencode = subprocess.run(command_reencode, capture_output=True, text=True)
        if result_reencode.returncode == 0:
            _log(f"[SUCCESS] Re-encoding conversion completed: {output_path}")
            return output_path
        else:
            _log(f"[ERROR] MP4 conversion failed. Code: {result_reencode.returncode}")
            if output_path.exists():
                output_path.unlink()
            return None

# --- Function to merge consecutive segments ---
def merge_segments(segments, gap_threshold=0.5):
    if not segments:
         return segments
    merged = [segments[0]]
    for seg in segments[1:]:
         last_seg = merged[-1]
         if seg[0] == last_seg[0] and (float(seg[1]) - float(last_seg[2])) <= gap_threshold:
              new_seg = (last_seg[0], last_seg[1], seg[2]) + last_seg[3:]
              merged[-1] = new_seg
         else:
              merged.append(seg)
    return merged

# --- Function to compute speaker embedding using MFCC mean and std ---
def get_embeddings(audio_path: Path, start: float, end: float, orig_label: str = "", n_mfcc=40):
    """
    Computes a speaker embedding for an audio segment using MFCCs and their
    first (delta) and second (delta-delta) derivatives.

    The embedding consists of the concatenated mean and standard deviation
    of static MFCCs, delta MFCCs, and delta-delta MFCCs.

    Args:
        audio_path: Path to the full audio file.
        start: Start time of the segment in seconds.
        end: End time of the segment in seconds.
        orig_label: Original label of the segment (for logging).
        n_mfcc: Number of MFCC coefficients to compute.

    Returns:
        A normalized numpy array representing the speaker embedding.
        Returns a normalized zero-like vector if computation fails or segment is too short.
    """
    # Calculate the expected dimension: (static + delta + delta-delta) * (mean + std) * n_mfcc
    embedding_dim = n_mfcc * 3 * 2

    try:
        duration = end - start
        # Add a check for minimum duration, e.g., 50ms, as very short clips are problematic
        min_duration = 0.05 # 50 milliseconds
        if duration < min_duration:
            _log(f"[WARN] Segment duration ({duration:.3f}s) too short for reliable embedding: "
                 f"{orig_label}-{start:.2f}-{end:.2f}. Returning zero vector.")
            embedding = np.zeros(embedding_dim) + 1e-6
            return embedding / np.linalg.norm(embedding)

        # Load the specific audio segment
        y, sr = librosa.load(str(audio_path), sr=16000, offset=start, duration=duration)

        # Check if loaded audio is substantial enough
        # n_fft default is 2048, hop_length default is 512. Need at least n_fft samples.
        if len(y) < 2048:
             _log(f"[WARN] Not enough audio samples ({len(y)}) loaded for segment "
                  f"{orig_label}-{start:.2f}-{end:.2f}. Returning zero vector.")
             embedding = np.zeros(embedding_dim) + 1e-6
             return embedding / np.linalg.norm(embedding)

        # 1. Compute static MFCC features
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
        _log(f"MFCC shape for segment {orig_label}-{start:.2f}-{end:.2f}: {mfcc.shape}")

        # Check if we have enough frames for delta calculation (librosa.feature.delta default width is 9)
        # Need at least ceil(width / 2) frames, typically 5 for width=9. Let's use a slightly safer margin.
        min_frames_for_delta = 7 # Heuristic threshold
        if mfcc.shape[1] < min_frames_for_delta:
            _log(f"[WARN] Segment yielded too few MFCC frames ({mfcc.shape[1]}) "
                 f"for delta calculation: {orig_label}-{start:.2f}-{end:.2f}. "
                 f"Using only static MFCC stats and padding.")
            mfcc_mean = np.mean(mfcc, axis=1)
            mfcc_std = np.std(mfcc, axis=1)
            # Create embedding with static stats and pad the rest with zeros
            # Dimension for static = n_mfcc * 2
            static_embedding = np.concatenate([mfcc_mean, mfcc_std])
            padding = np.zeros(embedding_dim - (n_mfcc * 2))
            embedding = np.concatenate([static_embedding, padding])

        else:
            # 2. Compute Delta features
            mfcc_delta = librosa.feature.delta(mfcc)

            # 3. Compute Delta-Delta features
            mfcc_delta2 = librosa.feature.delta(mfcc, order=2)

            # 4. Calculate statistics for each feature type
            mfcc_mean = np.mean(mfcc, axis=1)
            mfcc_std = np.std(mfcc, axis=1)
            delta_mean = np.mean(mfcc_delta, axis=1)
            delta_std = np.std(mfcc_delta, axis=1)
            delta2_mean = np.mean(mfcc_delta2, axis=1)
            delta2_std = np.std(mfcc_delta2, axis=1)

            # 5. Concatenate all stats to form the final embedding
            embedding = np.concatenate([
                mfcc_mean, mfcc_std,
                delta_mean, delta_std,
                delta2_mean, delta2_std
            ])

        _log(f"Computed embedding for segment {orig_label}-{start:.2f}-{end:.2f} with target shape ({embedding_dim},). Actual shape: {embedding.shape}")

        # 6. Normalize the final embedding (L2 norm)
        norm = np.linalg.norm(embedding)
        if norm == 0:
            _log(f"[WARN] Embedding norm is zero for segment {orig_label}-{start:.2f}-{end:.2f}. Using epsilon.")
            norm = 1e-6 # Avoid division by zero, use a small epsilon
        embedding = embedding / norm

    except Exception as e:
        _log(f"[ERROR] Failed to compute embedding for segment {orig_label}-{start:.2f}-{end:.2f}: {e}")
        # Return a normalized zero-like vector matching the expected dimension in case of any error
        embedding = np.zeros(embedding_dim) + 1e-6
        embedding = embedding / np.linalg.norm(embedding) # Normalize the zero-like vector too

    return embedding


# --- Helper: Determine gender from original label ---
def get_gender(orig_label: str) -> str:
    l = orig_label.lower()
    if l.startswith("male"):
        return "male"
    elif l.startswith("female"):
        return "female"
    else:
        return "unknown"

# --- Speaker Tagger Class with Gender-aware Clustering and Chronological Labeling ---
class SpeakerTagger:
    def __init__(self):
        _log("SpeakerTagger initialized in auto-detection mode.")

    def process_audio(self, audio_path: Path):
        _log(f"Processing audio: {audio_path}")
        try:
            segmenter = Segmenter()
            segments = segmenter(str(audio_path))
            _log(f"Speech segmentation completed. {len(segments)} segments found.")
            segments = merge_segments(segments)
            _log(f"After merging, {len(segments)} segments remain.")

            # For each valid segment, extract embedding and detected gender.
            embeddings = []
            valid_segments = []
            genders = []
            for seg in segments:
                if len(seg) >= 3:
                    orig_label = seg[0]
                    try:
                        start = float(seg[1])
                        end = float(seg[2])
                    except Exception as e:
                        _log(f"[ERROR] Could not convert start/end to float for segment {seg}: {e}")
                        continue
                    emb = get_embeddings(audio_path, start, end, orig_label)
                    embeddings.append(emb)
                    valid_segments.append(seg)
                    genders.append(get_gender(orig_label))
            embeddings = np.array(embeddings)
            _log(f"Computed embeddings for segments, resulting in shape {embeddings.shape}.")

            # Group segments by gender and perform clustering for each group separately.
            groups = {}
            for emb, seg, gender in zip(embeddings, valid_segments, genders):
                groups.setdefault(gender, {"embeddings": [], "segments": []})
                groups[gender]["embeddings"].append(emb)
                groups[gender]["segments"].append(seg)

            # Run clustering on each gender group.
            composite_labels = {}  # key: composite label (gender, cluster), value: new speaker number
            group_clustered_segments = []
            for gender, data in groups.items():
                group_emb = np.array(data["embeddings"])
                group_segs = data["segments"]
                if len(group_emb) == 0:
                    continue
                clustering = AgglomerativeClustering(metric='cosine',
                                                     linkage='average',
                                                     distance_threshold=0.05, 
                                                     n_clusters=None)
                group_labels = clustering.fit_predict(group_emb)
                _log(f"Gender group '{gender}' produced {len(set(group_labels))} clusters.")
                # Add composite label (gender, original cluster) to each segment.
                for seg, clabel in zip(group_segs, group_labels):
                    # Append composite label to segment; we keep the original label for debugging.
                    # We'll later reassign chronological numbers.
                    seg_with_comp = seg + (gender, clabel)  # now seg becomes (orig_label, start, end, [optional extra], gender, cluster)
                    group_clustered_segments.append(seg_with_comp)

            # Now, assign new speaker numbers in chronological order.
            # First, sort all segments by start time.
            group_clustered_segments.sort(key=lambda s: float(s[1]))
            # Map composite (gender, cluster) to a new speaker number in order of first appearance.
            composite_to_new = {}
            next_speaker_number = 0
            final_segments = []
            for seg in group_clustered_segments:
                # seg is (orig_label, start, end, [optional extra], gender, cluster)
                comp = (seg[-2], seg[-1])  # (gender, cluster)
                if comp not in composite_to_new:
                    composite_to_new[comp] = next_speaker_number
                    next_speaker_number += 1
                # For output, we want (start, end, new_speaker_number, orig_label) 
                # We'll use the first element (orig_label) from seg.
                # seg[1] and seg[2] are start and end.
                new_seg = (float(seg[1]), float(seg[2]), composite_to_new[comp] + 1, seg[-2], seg[0])
                final_segments.append(new_seg)

            _log(f"Chronologically assigned {next_speaker_number} unique speakers.")
            return final_segments

        except Exception as e:
            _log(f"[ERROR] Speech segmentation and clustering failed: {e}")
            sys.exit(1)

def format_speaker_label(speaker_num: int) -> str:
    # Format speaker number into a label like 'Speaker 1', 'Speaker 2', etc.
    return f"Speaker {speaker_num}"

# --- Main Execution ---
def main(input_file: str, output_file: str):
    file_path = Path(input_file)
    audio_path = extract_audio(file_path)
    tagger = SpeakerTagger()
    segments = tagger.process_audio(audio_path)
    with open(output_file, "w") as f:
        for seg in segments:
            # seg is (start, end, speaker_number, gender, orig_label) - 5 values
            start, end, speaker, gender, orig_label = seg  # Fixed: unpack 5 values instead of 4
            label = format_speaker_label(speaker)
            f.write(f"start={start:.2f}s stop={end:.2f}s {label} (Original: {orig_label})\n")
    _log(f"Segmentation and clustering results written to {output_file}.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python speaker_tagger.py <input_file> <output_file>")
        sys.exit(1)
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    main(input_file, output_file)
