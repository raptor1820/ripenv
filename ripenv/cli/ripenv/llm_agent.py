"""
LLM Agent for natural language command processing in ripenv CLI.
Integrates with Google Gemini to parse user intent and execute appropriate commands.
"""

from __future__ import annotations

import json
import os
from typing import Optional, Dict, Any, List
from pathlib import Path

import click
from google import genai
from google.genai import types
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

console = Console()

# Gemini client instance - will be initialized when needed
client: Optional[genai.Client] = None

def initialize_gemini_client() -> genai.Client:
    """Initialize Gemini client with API key from environment or config."""
    global client
    
    if client is not None:
        return client
    
    # Try to get API key from environment
    api_key = os.getenv("GOOGLE_API_KEY")
    
    # If not in environment, try to get from ripenv config
    if not api_key:
        config_file = Path.home() / ".ripenv" / "config.env"
        if config_file.exists():
            from dotenv import dotenv_values
            config = dotenv_values(config_file)
            api_key = config.get("GOOGLE_API_KEY")
    
    if not api_key:
        raise click.ClickException(
            "Google Gemini API key not found. Please set GOOGLE_API_KEY environment variable "
            "or run 'ripenv configure' to add it to your configuration."
        )
    
    # Set environment variable for the client (it auto-detects GEMINI_API_KEY)
    os.environ['GEMINI_API_KEY'] = api_key
    
    # Initialize the client using the new SDK pattern
    try:
        test_client = genai.Client()
        
        # Try different models in order of preference (using correct model names from docs)
        model_options = [
            'gemini-2.5-flash',        # Latest flash model from documentation
            'gemini-1.5-flash',        # Previous flash model
            'gemini-1.5-pro',          # Pro version
            'gemini-pro'               # Fallback
        ]
        
        for model_name in model_options:
            try:
                # Try a simple test generation to verify the model works
                test_response = test_client.models.generate_content(
                    model=model_name,
                    contents="Test",
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=10
                    )
                )
                
                # If we get here, the model works
                client = test_client
                console.print(f"[dim green]✅ Using Gemini model: {model_name}[/dim green]")
                # Store the working model name for later use
                client._working_model = model_name
                return client
                
            except Exception as e:
                # Try next model
                console.print(f"[dim yellow]Model {model_name} failed: {str(e)[:100]}[/dim yellow]")
                continue
        
        # If no models work, raise an error
        raise click.ClickException(
            f"No compatible Gemini models found. Please check your API key and try again."
        )
        
    except Exception as e:
        if "403" in str(e) or "401" in str(e):
            raise click.ClickException(
                "Authentication failed. Please check your Google API key is correct and has access to Gemini API."
            )
        else:
            raise click.ClickException(f"Failed to initialize Gemini: {e}")

def parse_user_intent(user_input: str) -> Dict[str, Any]:
    """
    Use Google Gemini to parse user intent and determine what command to execute.
    
    Returns a structured response with:
    - command: The ripenv command to execute
    - confidence: Confidence level (0-1)
    - parameters: Dictionary of parameters needed
    - clarification_needed: List of parameters that need user input
    """
    
    try:
        gemini_client = initialize_gemini_client()
    except Exception as e:
        raise click.ClickException(f"Failed to initialize Gemini client: {e}")
    
    # System prompt that defines the ripenv CLI capabilities
    system_prompt = """
You are an AI assistant for the ripenv CLI tool. ripenv is an end-to-end encrypted environment management system.

Available commands:
1. "configure" - Setup Supabase and Google AI credentials
2. "init" - Generate encryption keyfile
3. "encrypt" - Encrypt environment files (requires project-id)
4. "decrypt" - Decrypt environment files (requires project-id, folder path)
5. "hook" - Install pre-commit Git hook
6. "status" - Show system status

Your job is to parse natural language requests and determine:
1. Which command the user wants to run
2. What parameters are needed
3. What additional information you need to ask for

Respond ONLY with valid JSON in this exact format:
{
  "command": "command_name",
  "confidence": 0.95,
  "parameters": {
    "project_id": "value_if_provided",
    "folder": "value_if_provided",
    "force": true/false
  },
  "clarification_needed": ["parameter_names_that_need_user_input"],
  "reasoning": "brief explanation of your decision"
}

Examples:
- "encrypt my env file" → {"command": "encrypt", "confidence": 0.9, "parameters": {}, "clarification_needed": ["project_id"], "reasoning": "User wants to encrypt, but needs project ID"}
- "decrypt the secrets for project abc123" → {"command": "decrypt", "confidence": 0.95, "parameters": {"project_id": "abc123"}, "clarification_needed": [], "reasoning": "Clear decrypt command with project ID"}
- "add a git hook" → {"command": "hook", "confidence": 0.9, "parameters": {}, "clarification_needed": [], "reasoning": "User wants to install pre-commit hook"}
"""

    user_prompt = f"Parse this user request: '{user_input}'"
    
    # Combine system prompt and user prompt
    full_prompt = f"{system_prompt}\n\nUser Request: {user_prompt}"
    
    try:
        response = gemini_client.models.generate_content(
            model=getattr(gemini_client, '_working_model', 'gemini-2.5-flash'),
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,  # Low temperature for consistent parsing
                max_output_tokens=500
            )
        )
        
        # Check if response has text
        if not response.text:
            raise ValueError("Empty response from Gemini")
        
        response_text = response.text.strip()
        
        # Sometimes Gemini wraps JSON in markdown code blocks, so clean it
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "").replace("```", "").strip()
        elif response_text.startswith("```"):
            response_text = response_text.replace("```", "").strip()
            
        # Parse the JSON response
        try:
            result = json.loads(response_text)
            
            # Validate required fields
            required_fields = ["command", "confidence", "parameters", "clarification_needed"]
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")
            
            return result
            
        except json.JSONDecodeError as e:
            # If JSON parsing fails, try to extract JSON from the response
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                try:
                    result = json.loads(json_match.group())
                    return result
                except json.JSONDecodeError:
                    pass
            
            raise ValueError(f"Invalid JSON response from Gemini: {e}\nResponse: {response_text}")
        
    except Exception as e:
        raise click.ClickException(f"Failed to parse user intent: {e}")

def collect_missing_parameters(clarification_needed: List[str], parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Interactively collect missing parameters from the user.
    """
    
    console.print()
    console.print(Panel(
        Text("I need some additional information to proceed:", style="bold cyan"),
        title="[bold yellow]🤖 AI Assistant",
        border_style="cyan",
        padding=(1, 2)
    ))
    
    for param in clarification_needed:
        if param == "project_id":
            project_id = click.prompt(
                "🆔 Please provide your project ID", 
                type=str
            )
            parameters["project_id"] = project_id
        
        elif param == "folder":
            folder = click.prompt(
                "📁 Please provide the folder path containing encrypted files",
                type=str,
                default="."
            )
            parameters["folder"] = folder
        
        elif param == "env_file":
            env_file = click.prompt(
                "📄 Please provide the path to your .env file",
                type=str,
                default=".env"
            )
            parameters["env_file"] = env_file
        
        elif param == "keyfile":
            keyfile = click.prompt(
                "🔑 Please provide the path to your keyfile",
                type=str,
                default="mykey.enc.json"
            )
            parameters["keyfile"] = keyfile
    
    # Ask about pre-commit hook if doing encryption
    if parameters.get("command") == "encrypt":
        add_hook = click.confirm(
            "🪝 Would you like me to install a pre-commit hook to prevent accidental commits?",
            default=True
        )
        parameters["add_hook"] = add_hook
    
    return parameters

def execute_command(command: str, parameters: Dict[str, Any]) -> bool:
    """
    Execute the determined command with the collected parameters.
    Returns True if successful, False otherwise.
    """
    
    import subprocess
    import sys
    from pathlib import Path
    
    try:
        # Build the ripenv command
        cmd = ["ripenv", command]
        
        if command == "configure":
            console.print("\n🔧 [bold cyan]Running configuration setup...[/bold cyan]")
            if parameters.get("force"):
                cmd.append("--force")
        
        elif command == "init":
            console.print("\n🔑 [bold cyan]Generating encryption keyfile...[/bold cyan]")
            if parameters.get("force"):
                cmd.append("--force")
            if parameters.get("filename"):
                cmd.extend(["--filename", parameters["filename"]])
        
        elif command == "encrypt":
            console.print(f"\n🔒 [bold cyan]Encrypting environment for project {parameters['project_id']}...[/bold cyan]")
            cmd.extend(["--project-id", parameters["project_id"]])
            if parameters.get("env_file"):
                cmd.extend(["--env", parameters["env_file"]])
            if parameters.get("force"):
                cmd.append("--force")
        
        elif command == "decrypt":
            console.print(f"\n🔓 [bold cyan]Decrypting environment for project {parameters['project_id']}...[/bold cyan]")
            cmd.extend(["--project-id", parameters["project_id"]])
            if parameters.get("folder"):
                cmd.extend(["--folder", parameters["folder"]])
            if parameters.get("keyfile"):
                cmd.extend(["--keyfile", parameters["keyfile"]])
            if parameters.get("force"):
                cmd.append("--force")
        
        elif command == "hook":
            console.print("\n🪝 [bold cyan]Installing pre-commit hook...[/bold cyan]")
            if parameters.get("force"):
                cmd.append("--force")
        
        elif command == "status":
            console.print("\n📊 [bold cyan]Checking system status...[/bold cyan]")
        
        else:
            console.print(f"[red]❌ Unknown command: {command}[/red]")
            return False
        
        # Execute the command
        import os
        env = os.environ.copy()
        # Set UTF-8 encoding to handle Unicode characters properly on Windows
        env['PYTHONIOENCODING'] = 'utf-8'
        
        result = subprocess.run(cmd, capture_output=True, text=True, env=env, encoding='utf-8')
        
        # Print the output directly without Rich markup processing to avoid parsing conflicts
        if result.stdout:
            print(result.stdout, end='')
        if result.stderr:
            print(result.stderr, end='')
        
        success = result.returncode == 0
        
        # If encrypt was successful and user wants hook, install it
        if success and command == "encrypt" and parameters.get("add_hook"):
            console.print("\n🪝 [bold cyan]Installing pre-commit hook...[/bold cyan]")
            hook_result = subprocess.run(["ripenv", "hook"], capture_output=True, text=True, env=env, encoding='utf-8')
            if hook_result.stdout:
                print(hook_result.stdout, end='')
            if hook_result.returncode != 0:
                console.print("[yellow]⚠️ Hook installation failed, but encryption succeeded[/yellow]")
        
        if success:
            console.print("\n[green]✅ Command completed successfully![/green]")
        else:
            console.print(f"\n[red]❌ Command failed with exit code {result.returncode}[/red]")
        
        return success
    
    except Exception as e:
        console.print(f"\n[red]❌ Error executing command: {e}[/red]")
        return False

def show_intent_confirmation(intent: Dict[str, Any], user_input: str) -> bool:
    """
    Show the parsed intent to the user and ask for confirmation.
    """
    
    console.print()
    
    # Create a summary of what we understood
    summary_text = Text()
    summary_text.append("I understood that you want to: ", style="cyan")
    summary_text.append(f"{intent['command']}", style="bold yellow")
    
    if intent.get("reasoning"):
        summary_text.append(f"\n\nReasoning: {intent['reasoning']}", style="dim cyan")
    
    # Show parameters if any
    if intent["parameters"]:
        summary_text.append("\n\nParameters I detected:", style="cyan")
        for key, value in intent["parameters"].items():
            summary_text.append(f"\n  • {key}: {value}", style="green")
    
    # Show what we need to ask for
    if intent["clarification_needed"]:
        summary_text.append("\n\nI'll need to ask you for:", style="cyan")
        for param in intent["clarification_needed"]:
            summary_text.append(f"\n  • {param}", style="yellow")
    
    summary_text.append(f"\n\nConfidence: {intent['confidence']:.1%}", style="dim cyan")
    
    panel = Panel(
        summary_text,
        title="[bold green]🤖 AI Understanding",
        border_style="green",
        padding=(1, 2)
    )
    
    console.print(panel)
    
    return click.confirm("\n✨ Does this look correct? Shall I proceed?", default=True)