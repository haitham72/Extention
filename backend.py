# backend.py (Final Vercel-compatible code - NO JSON SAVING)

from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables (for local testing, Vercel handles env vars otherwise)
load_dotenv()

app = Flask(__name__)
CORS(app) 

# Configure Gemini API
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

@app.route('/')
def home():
    return "YouTube Summarizer API is running!"

# ----------------------------------------------------------------------
# --- THE ONLY REQUIRED ROUTE: SUMMARIZE (No caching) ------------------
# ----------------------------------------------------------------------
@app.route('/summarize', methods=['POST'])
def summarize():
    data = request.get_json()
    transcript = data.get('transcript')
    summary_type = data.get('summary_type', 'concise')
    video_id = data.get('video_id') # Kept for logging/future but not used for cache

    if not transcript:
        return jsonify({'error': 'No transcript provided'}), 400
    
    # Define prompt based on summary_type
    if summary_type == 'concise':
        # Your concise prompt
        prompt = "You are a YouTube summarizer. Generate a single, **concise paragraph** (under 20 words) summarizing this transcript. the main idea to look for is how valuable is this video, is it click bait or superb value of user`s times\n\nTranscript: \""
    elif summary_type == 'insights':
        # Your insights prompt
        prompt = "You are a YouTube summarizer. Generate a list (use bullet points) of the **key insights** from this transcript. Use emojis at the start of each point. Focus on  main ideas.\n\nTranscript: \""
    elif summary_type == 'detailed':
        # Your detailed prompt
        prompt = "You are a YouTube summarizer. Generate a detailed, multi-paragraph summary (under 450 words) of this transcript, use proper structure and bullet points covering all main topics and supporting details.\n\nTranscript: \""
    else:
        return jsonify({'error': 'Invalid summary_type'}), 400

    try:
        # Use a fast model for summarization
        model = genai.GenerativeModel("gemini-1.5-flash") 
        response = model.generate_content(prompt + transcript)
        
        print(f"Summary generated successfully (type: {summary_type}, video: {video_id})")
        return jsonify({'summary': response.text})
    except Exception as e:
        print(f"Error generating summary: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Vercel requires this minimal setup for the app object
if __name__ == '__main__':
    app.run(debug=True)