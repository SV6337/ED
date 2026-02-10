import random
import time
from groq import Groq
import os
from dotenv import load_dotenv
import json # Used for safer parsing

# Load environment variables
load_dotenv()

# Replace hardcoded API key with environment variable
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Initialize Groq client
# Use os.getenv() to securely load the API key
client = Groq(api_key=GROQ_API_KEY)

APTITUDE_CATEGORIES = {
    "quantitative": ["Percentage calculations", "Time and work problems", "Profit and loss", "Algebra", "Geometry"],
    "logical": ["Number series", "Letter series", "Analogies", "Blood relations", "Direction sense"],
    "verbal": ["Synonyms", "Antonyms", "Reading comprehension", "Sentence completion", "Error detection"]
}

def generate_question(category: str) -> dict:
    """Generate an aptitude question using Groq API"""
    prompt = f"""
    Generate a challenging {category} aptitude question with:
    1. A clear question statement
    2. 4 multiple choice options (labeled a, b, c, d)
    3. The correct answer (just the letter)
    4. A brief explanation
    
    Format as JSON with keys: question, options, answer, explanation
    """
    
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        # Use json.loads() for safe parsing
        return json.loads(response.choices[0].message.content)
        
    except Exception as e:
        # Print a clear error message including the exception type
        print(f"--- ERROR: Question Generation Failed for {category.upper()} ---")
        print(f"Details: {e}")
        # Return a fallback question
        return {
            "question": f"Fallback {category} question: If 2x + 5 = 15, what is x?",
            "options": {
                "a": "2",
                "b": "5",
                "c": "10",
                "d": "20"
            },
            "answer": "b",
            "explanation": "This is a fallback. The correct answer is 5. (15 - 5) / 2 = 5"
        }

def aptitude_simulator():
    print("\n🧠 Aptitude Test Simulator for Interviews")
    print("----------------------------------------")
    
    # Get user preferences
    print("\nAvailable categories:")
    for i, category in enumerate(APTITUDE_CATEGORIES.keys(), 1):
        print(f"{i}. {category.capitalize()}")
    
    category_choice = input("\nChoose category (1-3) or 'all': ").lower()
    
    if category_choice == 'all':
        selected_categories = list(APTITUDE_CATEGORIES.keys())
    else:
        try:
            selected_categories = [list(APTITUDE_CATEGORIES.keys())[int(category_choice)-1]]
        except (ValueError, IndexError):
            print("Invalid choice. Defaulting to all categories.")
            selected_categories = list(APTITUDE_CATEGORIES.keys())
    
    try:
        time_limit = int(input("Time limit per question (seconds): "))
    except ValueError:
        print("Invalid time. Defaulting to 60 seconds.")
        time_limit = 60
    
    # **KEY FIX: Fixed to 10 questions**
    total_questions = 10 
    
    score = 0
    questions_answered = 0
    
    print(f"\nStarting test with {total_questions} questions...")
    print(f"Time limit: {time_limit} seconds per question\n")
    
    for i in range(total_questions):
        category = random.choice(selected_categories) 
        
        # --- NEW ROBUSTNESS CHECK ---
        try:
            questions_answered += 1
            print(f"\n📝 Question #{questions_answered} ({category.capitalize()})")
            question_data = generate_question(category)
            
            # Check if question data is valid (i.e., not a completely empty response)
            if not question_data.get('question'):
                 print("Skipping question due to empty data from API.")
                 continue
                 
            print(f"\n{question_data['question']}\n")
            for opt in ['a', 'b', 'c', 'd']:
                if opt in question_data.get('options', {}):
                    print(f"{opt}. {question_data['options'][opt]}")
            
            # Start timer
            start_time = time.time()
            user_answer = input("\nYour answer (a-d): ").lower()
            elapsed = time.time() - start_time
            
            # Check time
            if elapsed > time_limit:
                print("\n⏰ Time's up! Your answer was recorded but time limit exceeded.")
            
            # Check answer
            correct_answer = question_data.get('answer', 'z').lower()
            
            if user_answer == correct_answer:
                score += 1
                print("\n✅ Correct!")
            else:
                # Use .get to prevent crash if 'answer' key is missing
                print(f"\n❌ Incorrect. The correct answer is {correct_answer.upper()}.")
            
            print(f"\nExplanation: {question_data.get('explanation', 'No explanation provided.')}")
            
            # Show progress
            print(f"\nCurrent score: {score}/{questions_answered}")
        
        except EOFError:
            # Catches issues common in non-interactive environments (like some IDEs)
            print("\n🚨 Input stream closed (EOFError). Cannot continue interactive test.")
            break
        except Exception as e:
            # Catches any unexpected runtime error during question display or user input
            print(f"\n⚠️ An unexpected error occurred during question {questions_answered}: {e}")
            # Use 'continue' to skip the bad iteration and try the next one
            continue 
    
    # Final results
    print("\n🏁 Test Completed!")
    print(f"Final Score: {score}/{total_questions} ({score/total_questions*100:.1f}%)")
    
    # Provide personalized feedback
    if score/total_questions >= 0.8:
        print("🌟 Excellent! You're well prepared for aptitude tests!")
    elif score/total_questions >= 0.5:
        print("👍 Good job! With some more practice you'll excel!")
    else:
        print("💪 Keep practicing! Focus on your weaker areas.")

if __name__ == "__main__":
    aptitude_simulator()