from groq import Groq
import pyttsx3
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Groq client with your API key
client = Groq(api_key=os.getenv("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"))

# Interview Prompt Template
base_prompt = """
Act as an interviewer for a {job_type} interview. Your job is to ask interview questions one by one related to the job type and evaluate the candidate's answers.

1. Ask questions related to the skills, experience, and problem-solving abilities relevant to the {job_type}. Ask only one question at a time.
2. After each question, wait for the response, evaluate the candidate's answer based on relevance, clarity, and completeness.
3. Provide constructive feedback and assign a score out of 10 for the response. Explain the reasoning for the score.
4. Calculate the average score after every question.
5. Continue to the next question based on the previous response.
6. Keep a count of the number of questions and mention the question number.
7. Do not say "Let's begin with the first question" every time.
8. Display the score after every question and give suggestions to improve the answer.
9. Suggest a better answer based on the response.
10. After 15 questions, if the average score is below 6, inform the candidate that their responses are insufficient and suggest more preparation.
"""

def text_to_speech(text):
    """Convert text to speech."""
    try:
        engine = pyttsx3.init()
        engine.setProperty('rate', 150)
        engine.setProperty('volume', 0.9)
        engine.say(text)
        engine.runAndWait()
    except Exception as e:
        print(f"Text-to-speech error: {e}")

def interview_chatbot(job_type, conversation_history):
    """
    Conduct a job interview using Groq API.

    Args:
        job_type (str): The type of job for which the interview is being conducted.
        conversation_history (list): The list of all messages exchanged so far.

    Returns:
        str: The response from the AI.
    """
    # Add the initial instruction to the conversation history if it's empty
    if not conversation_history:
        conversation_history.append({"role": "system", "content": base_prompt.format(job_type=job_type)})
    
    try:
        # Send the full conversation to Groq API
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=conversation_history,
            temperature=1,
            max_tokens=1024,
            top_p=1,
            stop=None,
        )
        
        # Extract the AI's response
        ai_response = response.choices[0].message.content.strip()
        return ai_response
    except Exception as e:
        print(f"API Error: {e}")
        return "Sorry, I encountered an error. Please try again."

if __name__ == "__main__":
    # Get job type from the user
    text_to_speech("What type of job preparation are you searching for?")
    job_type = input("What type of job preparation are you searching for? ").strip()
    print(f"\nPreparing for a {job_type} interview...\n")
    
    # Initialize conversation history
    conversation_history = []

    while True:
        # Get the AI's response
        ai_response = interview_chatbot(job_type, conversation_history)
        print("Interviewer:", ai_response)
        text_to_speech(ai_response)
        
        # Update the conversation history with the AI's response
        conversation_history.append({"role": "assistant", "content": ai_response})
        
        # Get user input
        user_input = input("You: ").strip()
        if user_input.lower() in ['quit', 'break', 'stop', 'bye']:
            print("Goodbye! Best of luck with your interviews.")
            text_to_speech("Goodbye! Best of luck with your interviews.")
            break
        
        # Update the conversation history with the user's response
        conversation_history.append({"role": "user", "content": user_input})