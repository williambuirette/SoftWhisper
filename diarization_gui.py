"""
diarization_gui.py

This module adds diarization features into the graphical interface.
It provides a new checkbox "Enable diarization" (to be placed below the
"Generate SRT Subtitles" checkbox) and a function to merge speaker
information into the generated SRT subtitles.

When enabled, after transcription the SRT output can be processed so that
each subtitle line is prefixed with the corresponding speaker label as determined
by the diarization process. This module uses the APIs from diarizer_core_types.py
and speaker_tagger.py.
"""

import re
from pathlib import Path
import tkinter as tk
from tkinter import BooleanVar, Checkbutton

import speaker_tagger  # API for speaker segmentation and clustering
import diarizer_core_types  # Core types for transcription and subtitles (if needed)


class DiarizationOption:
    """
    A GUI component that adds an "Enable diarization" checkbox.
    
    This version does not call pack() automatically so that you can position
    the checkbox using grid.
    """
    def __init__(self, parent):
        self.var = BooleanVar(value=False)
        self.checkbox = Checkbutton(parent, text="Identify speakers (warning: increases processing time)", variable=self.var, font=("Arial", 10))
        # Do not call pack() here; let the parent manage placement.

    def is_enabled(self):
        return self.var.get()

    def is_enabled(self):
        return self.var.get()


def srt_time_to_seconds(time_str):
    """
    Converts an SRT time string of format "hh:mm:ss,ms" to seconds.
    """
    parts = time_str.split(':')
    hours = int(parts[0])
    minutes = int(parts[1])
    sec_ms = parts[2].split(',')
    seconds = int(sec_ms[0])
    milliseconds = int(sec_ms[1])
    total = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000.0
    return total


def parse_srt(srt_content):
    """
    Parses SRT content into a list of subtitle entries.
    
    Each entry is a dict with keys:
      - index: subtitle number (as string)
      - start_str, end_str: original timestamp strings
      - start, end: times in seconds
      - text: subtitle text
    """
    entries = []
    # Split entries by blank lines.
    blocks = re.split(r'\n\s*\n', srt_content.strip())
    for block in blocks:
        lines = block.splitlines()
        if len(lines) >= 3:
            index = lines[0].strip()
            timestamp_line = lines[1].strip()
            text = "\n".join(lines[2:]).strip()
            # Extract start and end times (format: hh:mm:ss,ms --> hh:mm:ss,ms)
            match = re.match(r'(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})', timestamp_line)
            if match:
                start_str, end_str = match.groups()
                start_sec = srt_time_to_seconds(start_str)
                end_sec = srt_time_to_seconds(end_str)
                entries.append({
                    'index': index,
                    'start_str': start_str,
                    'end_str': end_str,
                    'start': start_sec,
                    'end': end_sec,
                    'text': text
                })
    return entries


def merge_diarization(file_path, srt_content, remove_timestamps=False, progress_callback=None):
    """
    Processes diarization on the provided audio file and merges speaker information into the given SRT content.
    
    Parameters:
        file_path (str): The path to the audio file.
        srt_content (str): The SRT content generated from Whisper.
        remove_timestamps (bool): If True, the final output will not include the original segment numbers or timestamp lines.
                                  If False, the original SRT formatting (segment numbers and timestamps) is preserved.
        progress_callback (callable, optional): A function to report progress updates. It should accept two parameters:
            progress (int) and message (str).
    
    Returns:
        str: The merged output with speaker labels.
    """
    import time
    import re
    from pathlib import Path

    if progress_callback:
        progress_callback(0, "Starting diarization merge...")
    
    # Obtain diarization segments using the speaker tagger.
    import speaker_tagger
    tagger = speaker_tagger.SpeakerTagger()
    diarization_segments = tagger.process_audio(Path(file_path))
    if progress_callback:
        progress_callback(30, "Diarization segmentation complete.")
    
    # Parse the SRT content into entries.
    srt_entries = parse_srt(srt_content)
    if progress_callback:
        progress_callback(50, "Parsed SRT entries.")
    
    # For each SRT entry, determine the corresponding speaker segment and prepend the speaker label.
    merged_entries = []
    for entry in srt_entries:
        speaker_label = "[Speaker Unknown]: "
        # Each diarization segment is expected to be a tuple:
        # (start, end, speaker_number, gender, orig_label)
        for seg in diarization_segments:
            seg_start, seg_end, speaker_num, gender, orig_label = seg
            if seg_start <= entry['start'] < seg_end:
                speaker_label = f"[Speaker {speaker_num}]: "
                break
        new_text = f"{speaker_label}{entry['text']}"
        # Only include timestamps if remove_timestamps is False.
        timestamp_line = f"{entry['start_str']} --> {entry['end_str']}" if not remove_timestamps else ""
        merged_entries.append({
            'index': entry['index'],
            'timestamp': timestamp_line,
            'text': new_text
        })
    
    if progress_callback:
        progress_callback(80, "Merged speaker labels with SRT entries.")
    
    # Rebuild the output.
    srt_lines = []
    for entry in merged_entries:
        # Only include segment numbers and timestamps if subtitles are enabled.
        if not remove_timestamps:
            srt_lines.append(entry['index'])
            if entry['timestamp']:
                srt_lines.append(entry['timestamp'])
        srt_lines.append(entry['text'])
        srt_lines.append("")  # Blank line between entries.
    
    merged_text = "\n".join(srt_lines)
    
    if progress_callback:
        progress_callback(100, "Diarization merge complete.")
    
    return merged_text

# If needed, you can include a simple test routine here.
if __name__ == "__main__":
    # Example SRT content (for testing purposes)
    sample_srt = """1
00:00:01,000 --> 00:00:04,000
Hello, how are you?

2
00:00:05,000 --> 00:00:08,000
I'm doing well, thank you!
"""
    # Replace 'path/to/audio.wav' with an actual audio file path to test diarization.
    audio_file_path = "path/to/audio.wav"
    
    # For testing, call the merge_diarization function.
    merged = merge_diarization(audio_file_path, sample_srt)
    print("Merged SRT with Diarization:")
    print(merged)
