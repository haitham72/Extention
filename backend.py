from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
import google.generativeai as genai
import os
from dotenv import load_dotenv
import json
from datetime import datetime
import re

load_dotenv()

app = Flask(__name__)
CORS(app) 

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

@app.route('/')
def home():
    return "YouTube Summarizer API is running!"

# --- TRANSCRIPT FETCH ROUTE (Unchanged logic) ---
@app.route('/transcript', methods=['GET'])
def get_transcript():
    video_id = request.args.get('video_id')
    if not video_id:
        return jsonify({'error': 'No video_id provided'}), 400
    
    try:
        # NOTE: Using standard library function get_transcript for simplicity
        fetched_transcript = YouTubeTranscriptApi.get_transcript(video_id)
        
        # Format transcript into a single string with timestamps
        transcript_text = "\n".join([f"[{int(item['start'] // 60):02}:{int(item['start'] % 60):02}] {item['text']}" for item in fetched_transcript])
        
        return jsonify({
            'transcript': transcript_text,
            'status': 'Transcript fetched successfully'
        })
        
    except Exception as e:
        print(f"YouTubeTranscriptApi error: {str(e)}")
        return jsonify({'error': 'Failed to fetch transcript from API', 'details': str(e)}), 500

# --- SUMMARIZE ROUTE (Unchanged) ---
@app.route('/api/summarize', methods=['POST'])
def summarize():
    data = request.json
    transcript = data.get('transcript')
    summary_type = data.get('summary_type', 'insights')
    
    if not transcript:
        return jsonify({'error': 'No transcript provided'}), 400
    
    summary_type = str(summary_type).strip().lower() if summary_type else 'insights'

    if summary_type == 'insights':
        prompt = """You are a YouTube summarizer. Generate a single concise paragraph (under 20 words) summarizing this transcript. 

            The main idea to look for is: how valuable is this video? Is it clickbait or does it provide superb value to the user's time?

            IMPORTANT FORMATTING RULES:
            - Use ONLY HTML tags, NO markdown syntax (no **, no ###, no ```)
            - Start with: <h3>Summary</h3>
            - Write the paragraph in a <p> tag (no bold, no markdown)
            - DO NOT add any newlines, line breaks, or spacing between tags
            - Write all HTML on continuous lines without breaks
            - Keep the output compact with no blank lines
            - If the transcript is in Arabic, write the summary in Arabic
            - If the transcript is in English, write the summary in English

            Transcript: """
    elif summary_type == 'concise':
        prompt = """You are a YouTube summarizer. Generate a maximum of five concise bullet points (key insights) from this transcript.

            IMPORTANT FORMATTING RULES:
            - Use ONLY HTML tags, NO markdown syntax (no **, no ###, no ```)
            - Start with: <h3>Key Insights</h3>
            - Use <ul> and <li> tags for bullet points
            - Write the HTML compactly: <ul><li>First point</li><li>Second point</li></ul>
            - DO NOT add newlines between <li> tags
            - Use emojis at the start of each point
            - Focus on main ideas
            - Keep all HTML on minimal lines with no blank spaces between tags
            - If the transcript is in Arabic, write the bullet points in Arabic
            - If the transcript is in English, write the bullet points in English

            Transcript: """
    elif summary_type == 'detailed':
        prompt = """You are a YouTube summarizer. Generate a detailed, multi-paragraph summary (under 450 words) of this transcript.

        IMPORTANT FORMATTING RULES:
        - Use ONLY HTML tags, NO markdown syntax (no **, no ###, no ```)
        - Start with: <h3>Detailed Summary</h3>
        - Use <p> tags for paragraphs: <p>Paragraph text here</p>
        - Use <ul> and <li> tags for bullet points: <ul><li>Point</li><li>Point</li></ul>
        - Use <strong> tags for emphasis (not markdown **)
        - Use emojis at the start of key points
        - DO NOT add newlines between tags - write compactly
        - Separate paragraphs with </p><p> NOT with multiple line breaks
        - Keep all HTML compact with minimal whitespace
        - If the transcript is in Arabic, write the entire summary in Arabic
        - If the transcript is in English, write the entire summary in English

        Transcript: """
        
    else:
        return jsonify({'error': 'Invalid summary_type'}), 400
    
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt + transcript)
        return jsonify({'summary': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# --- DATA STORAGE ROUTE (FIXED FILENAME LOGIC) ---
@app.route('/api/store-video-data', methods=['POST'])
def store_video_data():
    data = request.json
    
    # FIX: Get the video_title. If not found, use a fallback string.
    video_title = data.get('video_title', 'Video_Data_Unknown').strip()
    video_id = data.get('video_id', 'unknown_id')

    # Sanitize the title for use as a filename
    safe_title = re.sub(r'[^\w\s!-]', '', video_title) # Remove special characters
    safe_title = re.sub(r'\s+', '_', safe_title)      # Replace spaces with underscores
    safe_title = safe_title[:150].strip('_')           # Trim to 50 chars and remove trailing _

    # If the safe title is empty (e.g., if the original title was just symbols), use the ID
    if not safe_title:
        safe_title = video_id
        
    # Construct the final filename: TITLE_ID_TIMESTAMP.json
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    # Use only the title for the filename (as requested), and ID as a unique suffix
    filename = f"{safe_title}_-_{video_id}_-_{timestamp_str}.json"
    
    # Set your desired save location here
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, 'video_data_files') 

    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    
    full_path = os.path.join(data_dir, filename)

    try:
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            
        print(f"✅ Successfully saved video data to {full_path}")
        return jsonify({'status': 'Data stored successfully', 'filename': filename}), 200
        
    except Exception as e:
        print(f"File saving error: {str(e)}")
        return jsonify({'error': 'Failed to store data on the server', 'details': str(e)}), 500

if __name__ == '__main__':
    print("Starting YouTube Summarizer API on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)