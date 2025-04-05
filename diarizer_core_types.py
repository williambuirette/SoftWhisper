"""
================================================================================
core_types.py: core types and video caching utilities
================================================================================

This module is a core part of the PerfectTranscribe application, designed to
manage and process video files for transcription. It provides classes and
utilities for handling subtitles, speaker information, and video caching.

Error Handling:
---------------
- If the VIDEO_CACHE_FOLDER or any video-specific subfolder cannot be created,
  a RuntimeError is raised with a descriptive message to facilitate debugging.

This module sets the foundation for the transcription process by ensuring that
video data and its associated metadata are managed efficiently and reliably.

================================================================================
"""

from pathlib import Path
import cv2
import hashlib
import re
from pyannote.audio import Pipeline

# Core types for PerfectTranscribe

 # Stores the start and end time in seconds internally for easier computation.
class SubtitleContext():
   
    # Tells if the segment is a song, the gender of the speaker, and whether it is music or noise.
    # If gender detection is disabled, segments are classified as 'speech' instead.
    # ("NoEnergy" means it is not supposedly meaningful, but I have seen noEnergy segments which are actually small speech segments.)  
    def __init__(self):


        self.start_time = 0.0
        self.end_time = 0.0
        self.text = ""

    # Returns the timestamp in [hh:mm:ss.fff] format, where hh = hours, mm = minutes, ss = seconds, fff = milliseconds.
    def return_timestamp(self, total_seconds: float) -> str:
        if total_seconds < 0:
            raise ValueError("return_timestamp(): total_seconds must be positive.")

        if not isinstance(total_seconds, (int, float)):
            raise TypeError(f"return_timestamp(): invalid parameter passed: {total_seconds!r}. Please provide a valid time (in seconds).")

        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        seconds = int(total_seconds % 60)
        milliseconds = int(round((total_seconds - int(total_seconds)) * 1000))
        timestamp = f"[{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}]"
        print(f"[DEBUG] Formatted timestamp for {total_seconds} seconds: {timestamp}")
        return timestamp

class SpeakerInfo(SubtitleContext):
    def __init__(self):
        super().__init__()
        self.gender: str = ""
        self.simple_description: str = ""
        self.detailed_description: str = ""

        #Vector representation of the speaker, which identifies it.
        self.vector_representation = None