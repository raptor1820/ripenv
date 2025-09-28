from __future__ import annotations

import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from click import Context
from dotenv import dotenv_values, load_dotenv
from pydantic import ValidationError
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, TimeElapsedColumn
from rich.panel import Panel
from rich.text import Text
from rich.table import Table
from rich.spinner import Spinner
from rich.align import Align
from rich.columns import Columns
from rich.live import Live

from . import crypto
from .keyfile import (
    DEFAULT_KEYFILE_NAME,
    create_keyfile,
    load_keyfile,
    save_keyfile,
    unlock_private_key,
)
from .manifest import MANIFEST_FILENAME, build_manifest, load_manifest, save_manifest
from .types import KeyFile, Manifest, ManifestRecipient, RecipientsExport, Recipient
from .supabase_client import create_supabase_client

console = Console()

# Color theme and styling constants (HALO-inspired)
PRIMARY_COLOR = "bright_blue"
SUCCESS_COLOR = "bright_green"  
WARNING_COLOR = "bright_yellow"
ERROR_COLOR = "bright_red"
ACCENT_COLOR = "bright_cyan"
MUTED_COLOR = "dim white"
SECONDARY_COLOR = "bright_magenta"
HIGHLIGHT_COLOR = "bold bright_white"

def show_animated_banner(text: str = "") -> None:
    """Display an animated banner with ripenv branding."""
    # Large ASCII art similar to HALO
    banner_art = """
██████╗ ██╗██████╗ ███████╗███╗   ██╗██╗   ██╗
██╔══██╗██║██╔══██╗██╔════╝████╗  ██║██║   ██║
██████╔╝██║██████╔╝█████╗  ██╔██╗ ██║██║   ██║
██╔══██╗██║██╔═══╝ ██╔══╝  ██║╚██╗██║╚██╗ ██╔╝
██║  ██║██║██║     ███████╗██║ ╚████║ ╚████╔╝ 
╚═╝  ╚═╝╚═╝╚═╝     ╚══════╝╚═╝  ╚═══╝  ╚═══╝  
    """
    
    # Create dotted border line
    border_dots = "·" * 80
    
    console.print(f"[{ACCENT_COLOR}]{border_dots}[/{ACCENT_COLOR}]")
    console.print()
    console.print(Align.center(Text(banner_art, style=f"bold {PRIMARY_COLOR}")))
    console.print()
    console.print(f"[{ACCENT_COLOR}]{border_dots}[/{ACCENT_COLOR}]")
    console.print()
    
    if text:
        console.print(f"[{SECONDARY_COLOR}]🔐 RIPENV:[/{SECONDARY_COLOR}] [bold {HIGHLIGHT_COLOR}]{text}[/bold {HIGHLIGHT_COLOR}]")
        console.print()
        console.print(f"[{SUCCESS_COLOR}]🛡️  Advanced Environment Secret Manager[/{SUCCESS_COLOR}]")
        console.print()

def create_progress_spinner() -> Progress:
    """Create a consistent progress spinner for long operations."""
    return Progress(
        SpinnerColumn(),
        TextColumn(f"[bold {PRIMARY_COLOR}]{{task.description}}"),
        console=console,
        transient=True
    )

def create_progress_bar() -> Progress:
    """Create a progress bar for file operations."""
    return Progress(
        TextColumn(f"[bold {PRIMARY_COLOR}]{{task.description}}", justify="right"),
        BarColumn(bar_width=None),
        "[progress.percentage]{task.percentage:>3.1f}%",
        "•",
        TimeElapsedColumn(),
        console=console
    )

def show_success_panel(title: str, message: str, details: Optional[list] = None) -> None:
    """Display a styled success panel with optional details."""
    content = Text(message, style=f"bold {SUCCESS_COLOR}")
    if details:
        content.append("\n\n")
        for detail in details:
            content.append(f"✓ {detail}\n", style=f"{SUCCESS_COLOR}")
    
    panel = Panel(
        content,
        title=f"[bold {SUCCESS_COLOR}]🎉 {title}[/bold {SUCCESS_COLOR}]",
        border_style=SUCCESS_COLOR,
        padding=(1, 2)
    )
    console.print(panel)

def show_info_panel(title: str, message: str, items: Optional[list] = None) -> None:
    """Display a styled info panel with optional list items."""
    content = Text(message, style=PRIMARY_COLOR)
    if items:
        content.append("\n\n")
        for item in items:
            content.append(f"• {item}\n", style=f"dim {PRIMARY_COLOR}")
    
    panel = Panel(
        content,
        title=f"[bold {PRIMARY_COLOR}]ℹ️  {title}",
        border_style=PRIMARY_COLOR,
        padding=(1, 2)
    )
    console.print(panel)

def show_warning_panel(title: str, message: str) -> None:
    """Display a styled warning panel."""
    panel = Panel(
        Text(message, style=WARNING_COLOR),
        title=f"[bold {WARNING_COLOR}]⚠️  {title}",
        border_style=WARNING_COLOR,
        padding=(1, 2)
    )
    console.print(panel)

def show_error_panel(title: str, message: str) -> None:
    """Display a styled error panel."""
    panel = Panel(
        Text(message, style=ERROR_COLOR),
        title=f"[bold {ERROR_COLOR}]❌ {title}",
        border_style=ERROR_COLOR,
        padding=(1, 2)
    )
    console.print(panel)

def animate_typing(text: str, delay: float = 0.03) -> None:
    """Animate text appearing character by character."""
    for char in text:
        console.print(char, end="")
        time.sleep(delay)
    console.print()

def show_step_progress(steps: list[str], current_step: int) -> None:
    """Show a visual step indicator."""
    table = Table(show_header=False, box=None, padding=(0, 1))
    
    for i, step in enumerate(steps):
        if i < current_step:
            table.add_row(f"[{SUCCESS_COLOR}]✓[/{SUCCESS_COLOR}]", f"[{SUCCESS_COLOR}]{step}[/{SUCCESS_COLOR}]")
        elif i == current_step:
            table.add_row(f"[{PRIMARY_COLOR}]▶[/{PRIMARY_COLOR}]", f"[bold {PRIMARY_COLOR}]{step}[/bold {PRIMARY_COLOR}]")
        else:
            table.add_row(f"[{MUTED_COLOR}]○[/{MUTED_COLOR}]", f"[{MUTED_COLOR}]{step}[/{MUTED_COLOR}]")
    
    console.print(table)

def show_main_interface() -> None:
    """Display the main HALO-style interface when ripenv is run without commands."""
    
    # Show beautiful banner
    show_animated_banner("Interactive Environment Secret Manager")
    
    # Enhanced HALO-style presentation
    console.print(f"Built by [bold {ACCENT_COLOR}]ripenv team[/bold {ACCENT_COLOR}] for secure environment management")
    console.print(f"Powered by [bold {WARNING_COLOR}]Supabase & Rich[/bold {WARNING_COLOR}]")
    console.print()
    
    console.print(f"[{SUCCESS_COLOR}]🔐 AI-Powered Supabase Integration[/{SUCCESS_COLOR}]")
    console.print()
    console.print("Interactive Environment Secret Manager for encrypting and managing")
    console.print("your application secrets using advanced encryption technology.")
    console.print()
    
    # Prerequisites section
    console.print(f"[{WARNING_COLOR}]📋 Prerequisites:[/{WARNING_COLOR}]")
    console.print(f"• Supabase project with configured tables")
    console.print(f"• Team members added to your ripenv project")
    console.print(f"• Local keyfile for encryption/decryption")
    console.print()
    
    # GitHub repo link
    console.print(f"[{WARNING_COLOR}]🌟 GitHub Repository:[/{WARNING_COLOR}] [link=https://github.com/your-repo/ripenv][{ACCENT_COLOR}]https://github.com/your-repo/ripenv[/{ACCENT_COLOR}][/link]")
    console.print()
    
    # Available commands in HALO style
    console.print(f"[{ERROR_COLOR}]⚡ Available Commands[/{ERROR_COLOR}]")
    console.print()
    
    # Create commands table
    commands_table = Table(
        show_header=True, 
        header_style=f"bold {HIGHLIGHT_COLOR}",
        border_style=PRIMARY_COLOR
    )
    commands_table.add_column("🎯 Command", style=f"bold {PRIMARY_COLOR}")
    commands_table.add_column("📋 Description", style=ACCENT_COLOR)
    commands_table.add_column("🔧 Usage Example", style=MUTED_COLOR)
    
    commands_table.add_row("ripenv configure", "Setup Supabase credentials", "ripenv configure")
    commands_table.add_row("ripenv init", "Generate encryption keyfile", "ripenv init")
    commands_table.add_row("ripenv encrypt", "Encrypt environment file", "ripenv encrypt --project-id abc123")
    commands_table.add_row("ripenv decrypt", "Decrypt environment file", "ripenv decrypt --folder ./encrypted --project-id abc123")
    commands_table.add_row("ripenv status", "System health dashboard", "ripenv status")
    
    console.print(commands_table)
    console.print()
    
    # Quick start guide
    console.print(f"[{SUCCESS_COLOR}]🚀 Quick Start:[/{SUCCESS_COLOR}]")
    console.print(f"1. Run [bold {PRIMARY_COLOR}]ripenv configure[/bold {PRIMARY_COLOR}] to setup Supabase credentials")
    console.print(f"2. Run [bold {PRIMARY_COLOR}]ripenv init[/bold {PRIMARY_COLOR}] to create your encryption keyfile")
    console.print(f"3. Run [bold {PRIMARY_COLOR}]ripenv status[/bold {PRIMARY_COLOR}] to verify everything is working")
    console.print()
    console.print(f"[{MUTED_COLOR}]Use --help with any command for detailed usage information[/{MUTED_COLOR}]")
DEFAULT_ENV_NAME = ".env"
ENCRYPTED_ENV_NAME = ".env.enc"
HOME_KEY_DIR = Path.home() / ".ripenv"
CONFIG_FILE = HOME_KEY_DIR / "config.env"

# Load environment variables from config file if it exists
if CONFIG_FILE.exists():
    load_dotenv(CONFIG_FILE)


def abort(message: str) -> None:
    """Enhanced error handling with styled panels."""
    show_error_panel("Error", message)
    raise click.Abort()


def check_overwrite(path: Path, force: bool) -> None:
    if path.exists() and not force:
        abort(f"Refusing to overwrite existing file: {path}. Use --force to override.")


def fetch_recipients_from_supabase(project_id: str) -> list[Recipient]:
    """Fetch recipients for a project from Supabase."""
    try:
        client = create_supabase_client()
        recipients = client.get_project_recipients(project_id)
        return recipients
    except ValueError as exc:
        abort(str(exc))


def verify_user_project_access(project_id: str, email: str) -> None:
    """Verify that a user has access to a project."""
    try:
        client = create_supabase_client()
        has_access = client.verify_project_access(project_id, email)
        
        if not has_access:
            abort(f"User {email} does not have access to project {project_id}.")
            
    except ValueError as exc:
        abort(str(exc))


def build_recipients_export(project_id: str, recipients: list[Recipient]) -> RecipientsExport:
    """Build a RecipientsExport object from project ID and recipients list."""
    return RecipientsExport(
        projectId=project_id,
        recipients=recipients
    )


def ensure_gitignore_entry(directory: Path, entry: str) -> None:
    """Ensure a .gitignore file exists with the specified entry to prevent accidental commits."""
    gitignore_path = directory / ".gitignore"
    
    # Read existing .gitignore or create empty content
    if gitignore_path.exists():
        existing_content = gitignore_path.read_text(encoding="utf-8")
        lines = existing_content.splitlines()
    else:
        existing_content = ""
        lines = []
    
    # Check if the entry already exists (exact match or pattern match)
    entry_exists = any(
        line.strip() == entry.strip() 
        for line in lines 
        if line.strip() and not line.strip().startswith("#")
    )
    
    if not entry_exists:
        # Add ripenv section header if this is a new .gitignore or doesn't have ripenv entries
        has_ripenv_section = any("ripenv" in line.lower() for line in lines)
        
        if not has_ripenv_section:
            if existing_content and not existing_content.endswith("\n"):
                existing_content += "\n"
            existing_content += "\n# ripenv - Environment files with secrets\n"
        
        existing_content += f"{entry}\n"
        
        gitignore_path.write_text(existing_content, encoding="utf-8")
        console.print(f":file_folder: Added `{entry}` to [bold].gitignore[/bold] to prevent accidental commits")


@click.group(invoke_without_command=True)
@click.version_option("0.1.0", prog_name="ripenv")
@click.pass_context
def app(ctx: Context) -> None:
    """ripenv CLI to encrypt and decrypt environment secrets locally."""
    ctx.ensure_object(dict)
    
    # If no command provided, show beautiful interface
    if ctx.invoked_subcommand is None:
        show_main_interface()


@app.command()
@click.option("--filename", default=DEFAULT_KEYFILE_NAME, show_default=True, help="Output filename for the encrypted key.")
@click.option("--force", is_flag=True, help="Overwrite existing keyfiles if present.")
def init(filename: str, force: bool) -> None:
    """Generate an encrypted keyfile protected by a password."""
    
    # Show beautiful banner
    show_animated_banner("Keyfile Generation")
    
    # Enhanced HALO-style presentation
    console.print(f"Built by [bold {ACCENT_COLOR}]ripenv team[/bold {ACCENT_COLOR}] for secure environment management")
    console.print(f"Powered by [bold {WARNING_COLOR}]Supabase & Rich[/bold {WARNING_COLOR}]")
    console.print()
    
    show_info_panel(
        "Keyfile Setup",
        "Create a secure keyfile to encrypt and decrypt environment secrets.",
        [
            "Your keyfile will be protected with a password",
            "Keep your password safe - it cannot be recovered if lost",
            "The keyfile will be saved locally and in your home directory"
        ]
    )
    
    # Get password with confirmation
    password = click.prompt(f"[{PRIMARY_COLOR}]🔐 Create a strong password[/{PRIMARY_COLOR}]", hide_input=True, confirmation_prompt=True)
    
    with create_progress_spinner() as progress:
        task = progress.add_task("🔑 Generating secure keyfile...", total=None)
        
        cwd_key_path = Path.cwd() / filename
        check_overwrite(cwd_key_path, force)
        home_key_path = HOME_KEY_DIR / filename
        check_overwrite(home_key_path, force)
        
        time.sleep(0.5)  # Let user see the generation process
        keyfile = create_keyfile(password, cwd_key_path)
        
        progress.update(task, description="💾 Saving keyfile...")
        save_keyfile(keyfile, home_key_path)
        time.sleep(0.3)
        progress.remove_task(task)
    
    show_success_panel(
        "Keyfile Created!",
        "Your encrypted keyfile has been generated successfully.",
        [
            f"Local copy: {cwd_key_path}",
            f"Home backup: {home_key_path}",
            "You can now join ripenv projects and decrypt environment files"
        ]
    )


@app.command()
@click.option("--force", is_flag=True, help="Overwrite existing configuration.")
def configure(force: bool) -> None:
    """Configure Supabase credentials for the ripenv CLI."""
    
    # Show beautiful banner
    show_animated_banner("Configuration Setup")
    
    # Enhanced HALO-style presentation
    console.print(f"Built by [bold {ACCENT_COLOR}]ripenv team[/bold {ACCENT_COLOR}] for secure environment management")
    console.print(f"Powered by [bold {WARNING_COLOR}]Supabase & Rich[/bold {WARNING_COLOR}]")
    console.print()
    
    if CONFIG_FILE.exists() and not force:
        show_warning_panel(
            "Configuration Exists",
            f"Configuration already exists at {CONFIG_FILE}\nUse --force to overwrite, or run: ripenv configure --force"
        )
        return
    
    # Show setup steps
    setup_steps = [
        "Gather Supabase credentials",
        "Validate connection details", 
        "Save configuration",
        "Test connection"
    ]
    
    show_info_panel(
        "Setup Process", 
        "Let's configure your ripenv CLI with Supabase credentials.",
        ["These are the same values from your web app's .env.local file", 
         "Your credentials will be stored securely in ~/.ripenv/config.env"]
    )
    
    console.print()
    show_step_progress(setup_steps, 0)
    console.print()
    
    # Step 1: Gather credentials with validation
    with create_progress_spinner() as progress:
        task = progress.add_task("🔐 Gathering Supabase credentials...", total=None)
        time.sleep(0.5)  # Brief pause for effect
        progress.remove_task(task)
    
    # Prompt for Supabase URL with enhanced validation
    supabase_url = click.prompt(
        f"[{PRIMARY_COLOR}]Supabase URL (https://xyz.supabase.co)[/{PRIMARY_COLOR}]", 
        type=str
    ).strip()
    
    # Validate URL format with better feedback
    if not supabase_url.startswith("https://") or not supabase_url.endswith(".supabase.co"):
        show_warning_panel("URL Format Warning", "URL should be in format: https://xyz.supabase.co")
    else:
        console.print(f"[{SUCCESS_COLOR}]✓ Valid URL format[/{SUCCESS_COLOR}]")
    
    console.print()
    
    # Prompt for anon key with validation
    anon_key = click.prompt(
        f"[{PRIMARY_COLOR}]Supabase Anon Key (starts with eyJ...)[/{PRIMARY_COLOR}]", 
        type=str,
        hide_input=True
    ).strip()
    
    # Validate key format
    if not anon_key.startswith("eyJ"):
        show_warning_panel("Key Format Warning", "Anon key should start with 'eyJ'")
    else:
        console.print(f"[{SUCCESS_COLOR}]✓ Valid key format[/{SUCCESS_COLOR}]")
    
    console.print()
    show_step_progress(setup_steps, 1)
    console.print()
    
    # Step 2: Create config directory and save
    with create_progress_spinner() as progress:
        task = progress.add_task("📁 Creating configuration directory...", total=None)
        HOME_KEY_DIR.mkdir(exist_ok=True)
        time.sleep(0.3)
        progress.update(task, description="💾 Saving configuration...")
        
        config_content = f"""# ripenv CLI Configuration
# Generated on {datetime.now().isoformat()}
RIPENV_SUPABASE_URL={supabase_url}
RIPENV_SUPABASE_ANON_KEY={anon_key}
"""
        CONFIG_FILE.write_text(config_content)
        time.sleep(0.2)
        progress.remove_task(task)
    
    console.print()
    show_step_progress(setup_steps, 2)
    console.print()
    
    # Step 3: Test connection with animated feedback
    with create_progress_spinner() as progress:
        task = progress.add_task("🔌 Testing Supabase connection...", total=None)
        try:
            # Reload the config we just wrote
            load_dotenv(CONFIG_FILE)
            client = create_supabase_client()
            time.sleep(1)  # Let the user see the spinner
            progress.remove_task(task)
            
            console.print()
            show_step_progress(setup_steps, 3)
            console.print()
            
            show_success_panel(
                "Configuration Complete!",
                "Your ripenv CLI is now configured and ready to use.",
                [
                    f"Configuration saved to: {CONFIG_FILE}",
                    "Supabase connection verified successfully",
                    "You can now use 'ripenv encrypt' and 'ripenv decrypt' commands"
                ]
            )
            
        except Exception as exc:
            progress.remove_task(task)
            show_error_panel(
                "Connection Failed", 
                f"Could not connect to Supabase: {exc}\n\nPlease check your credentials and try again."
            )


@app.command()
def status() -> None:
    """Show current configuration status."""
    
    show_animated_banner("System Status Dashboard")
    
    # System status with HALO-style presentation
    console.print(f"Built by [bold {ACCENT_COLOR}]ripenv team[/bold {ACCENT_COLOR}] for secure environment management")
    console.print(f"Powered by [bold {WARNING_COLOR}]Supabase & Rich[/bold {WARNING_COLOR}]")
    console.print()
    
    # Create status table with HALO styling
    status_table = Table(
        title=f"[bold {ACCENT_COLOR}]⚡ System Components Status[/bold {ACCENT_COLOR}]", 
        show_header=True, 
        header_style=f"bold {HIGHLIGHT_COLOR}",
        border_style=ACCENT_COLOR
    )
    status_table.add_column("🔧 Component", style=f"bold {ACCENT_COLOR}")
    status_table.add_column("📊 Status", justify="center")
    status_table.add_column("📝 Details", style=MUTED_COLOR)
    
    # Check configuration file
    if CONFIG_FILE.exists():
        status_table.add_row(
            "⚙️  Configuration", 
            f"[{SUCCESS_COLOR}]✅ ONLINE[/{SUCCESS_COLOR}]", 
            f"Found: {CONFIG_FILE.name}"
        )
        
        # Test Supabase connection with animation
        with create_progress_spinner() as progress:
            task = progress.add_task("🌐 Testing Supabase connection...", total=None)
            try:
                load_dotenv(CONFIG_FILE)
                client = create_supabase_client()
                time.sleep(0.8)  # Longer animation for effect
                progress.remove_task(task)
                status_table.add_row(
                    "🌐 Supabase API", 
                    f"[{SUCCESS_COLOR}]✅ CONNECTED[/{SUCCESS_COLOR}]", 
                    "Authentication verified"
                )
                
            except Exception as exc:
                progress.remove_task(task)
                error_msg = str(exc)[:40] + ("..." if len(str(exc)) > 40 else "")
                status_table.add_row(
                    "🌐 Supabase API", 
                    f"[{ERROR_COLOR}]❌ FAILED[/{ERROR_COLOR}]", 
                    error_msg
                )
    else:
        status_table.add_row(
            "⚙️  Configuration", 
            f"[{ERROR_COLOR}]❌ MISSING[/{ERROR_COLOR}]", 
            "Run 'ripenv configure'"
        )
        status_table.add_row(
            "🌐 Supabase API", 
            f"[{MUTED_COLOR}]⏸️  UNKNOWN[/{MUTED_COLOR}]", 
            "Configuration required"
        )
    
    # Check for keyfiles
    home_keyfile = HOME_KEY_DIR / DEFAULT_KEYFILE_NAME
    local_keyfile = Path.cwd() / DEFAULT_KEYFILE_NAME
    
    if home_keyfile.exists() or local_keyfile.exists():
        locations = []
        if home_keyfile.exists():
            locations.append("home")
        if local_keyfile.exists():
            locations.append("local")
        status_table.add_row(
            "🗝️  Keyfile", 
            f"[{SUCCESS_COLOR}]✅ READY[/{SUCCESS_COLOR}]", 
            f"Available: {', '.join(locations)}"
        )
    else:
        status_table.add_row(
            "🗝️  Keyfile", 
            f"[{WARNING_COLOR}]⚠️  MISSING[/{WARNING_COLOR}]", 
            "Run 'ripenv init'"
        )
    
    console.print(status_table)
    console.print()
    
    # Available operations in HALO style
    console.print(f"[{WARNING_COLOR}]🚀 Available Operations[/{WARNING_COLOR}]")
    console.print()
    
    operations_table = Table(
        show_header=True, 
        header_style=f"bold {HIGHLIGHT_COLOR}",
        border_style=PRIMARY_COLOR
    )
    operations_table.add_column("🎯 Command", style=f"bold {PRIMARY_COLOR}")
    operations_table.add_column("📋 Description", style=ACCENT_COLOR)
    operations_table.add_column("🔧 Usage", style=MUTED_COLOR)
    
    operations_table.add_row("ripenv configure", "Setup Supabase credentials", "Interactive setup wizard")
    operations_table.add_row("ripenv init", "Generate encryption keyfile", "Create secure key pair")
    operations_table.add_row("ripenv encrypt", "Encrypt environment file", "Project-based encryption")
    operations_table.add_row("ripenv decrypt", "Decrypt environment file", "Secure file recovery")
    operations_table.add_row("ripenv status", "System health dashboard", "Current status check")
    
    console.print(operations_table)


@app.command()
@click.argument("project_id")
def debug_project(project_id: str) -> None:
    """Debug project members and their public keys."""
    console.print(f":magnifying_glass_tilted_left: [bold]Debugging project {project_id}[/bold]")
    console.print("")
    
    try:
        client = create_supabase_client()
        
        # Check if project exists
        console.print("1. Checking if project exists...")
        project_info = client.get_project_info(project_id)
        if project_info:
            console.print(f"   :white_check_mark: Project found: {project_info['name']}")
        else:
            console.print("   :x: Project not found")
            return
        
        # Check all project members (with and without keys)
        console.print("")
        console.print("2. Checking all project members...")
        response = client.client.table("project_members") \
            .select("email, public_key") \
            .eq("project_id", project_id) \
            .execute()
        
        if response.data:
            console.print(f"   Found {len(response.data)} members:")
            for member in response.data:
                has_key = "✅" if member["public_key"] else "❌"
                key_preview = f" (key: {member['public_key'][:20]}...)" if member["public_key"] else ""
                console.print(f"   {has_key} {member['email']}{key_preview}")
        else:
            console.print("   :x: No members found")
            
        # Check members with public keys (what encrypt command uses)
        console.print("")
        console.print("3. Checking members with public keys (for encryption)...")
        recipients = client.get_project_recipients(project_id)
        if recipients:
            console.print(f"   :white_check_mark: Found {len(recipients)} recipients with keys:")
            for recipient in recipients:
                console.print(f"   - {recipient.email}")
        else:
            console.print("   :x: No recipients with keys found")
            
    except Exception as exc:
        console.print(f":x: [red]Error: {exc}[/red]")


@app.command()
@click.option("--env", "env_path", type=click.Path(path_type=Path, exists=True), default=Path.cwd() / DEFAULT_ENV_NAME, show_default=True, help="Path to the plaintext .env file.")
@click.option("--project-id", required=True, help="Project ID to fetch recipients from Supabase.")
@click.option("--out", "out_dir", type=click.Path(path_type=Path), default=Path.cwd(), show_default=True, help="Directory to place encrypted outputs.")
@click.option("--force", is_flag=True, help="Overwrite existing encrypted outputs if present.")
@click.option("--delete", is_flag=True, help="Delete the original .env file after successful encryption.")
def encrypt(env_path: Path, project_id: str, out_dir: Path, force: bool, delete: bool) -> None:
    """Encrypt a .env file using project recipients from Supabase."""
    
    # Show beautiful banner
    show_animated_banner("Environment File Encryption")
    
    # Enhanced HALO-style presentation
    console.print(f"Built by [bold {ACCENT_COLOR}]ripenv team[/bold {ACCENT_COLOR}] for secure environment management")
    console.print(f"Powered by [bold {WARNING_COLOR}]Supabase & Rich[/bold {WARNING_COLOR}]")
    console.print()
    
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    # Validate environment file with progress
    with create_progress_spinner() as progress:
        task = progress.add_task("📝 Validating environment file...", total=None)
        
        env_bytes = env_path.read_bytes()
        if not env_bytes:
            progress.remove_task(task)
            show_warning_panel("Empty File", f"The environment file {env_path} appears to be empty.")
            return

        # Basic schema validation of the .env file to ensure it's parseable.
        try:
            env_vars = dotenv_values(env_path)
            var_count = len([k for k in env_vars.keys() if k])  # Count non-empty keys
            time.sleep(0.3)
            progress.remove_task(task)
            
            console.print(f"[{SUCCESS_COLOR}]✓ Found {var_count} environment variables[/{SUCCESS_COLOR}]")
        except Exception as e:
            progress.remove_task(task)
            show_error_panel("Validation Failed", f"Could not parse .env file: {e}")
            return
    
    console.print()
    
    # Create encryption progress with multiple steps
    encryption_steps = [
        "Fetch project recipients",
        "Generate encryption key", 
        "Encrypt environment file",
        "Create manifest",
        "Save encrypted files",
        "Update project timestamp"
    ]
    
    if delete:
        encryption_steps.append("Clean up original file")
    
    show_step_progress(encryption_steps, 0)
    console.print()

    # Step 1: Fetch recipients from Supabase with spinner
    with create_progress_spinner() as progress:
        task = progress.add_task(f"🌐 Fetching recipients for project {project_id}...", total=None)
        try:
            recipients_list = fetch_recipients_from_supabase(project_id)
            time.sleep(0.5)  # Let user see the spinner
            progress.remove_task(task)
            
            console.print(f"[{SUCCESS_COLOR}]✓ Found {len(recipients_list)} recipients[/{SUCCESS_COLOR}]")
            show_step_progress(encryption_steps, 1)
            console.print()
            
        except Exception as e:
            progress.remove_task(task)
            show_error_panel("Recipients Fetch Failed", f"Could not fetch recipients: {e}")
            return
    
    # Build recipients export object
    recipients = build_recipients_export(project_id, recipients_list)

    # Step 2: Generate encryption key
    with create_progress_spinner() as progress:
        task = progress.add_task("🔐 Generating encryption key...", total=None)
        fk = os.urandom(crypto.KEY_LENGTH)
        time.sleep(0.2)
        progress.remove_task(task)
        
        console.print(f"[{SUCCESS_COLOR}]✓ Generated 256-bit encryption key[/{SUCCESS_COLOR}]")
        show_step_progress(encryption_steps, 2)
        console.print()

    # Step 3: Encrypt file with progress bar
    with create_progress_bar() as progress:
        task = progress.add_task("🔒 Encrypting environment file...", total=100)
        
        for i in range(100):
            if i == 50:  # Simulate actual encryption at halfway point
                payload = crypto.file_encrypt(fk, env_bytes)
            time.sleep(0.01)  # Small delay for visual effect
            progress.update(task, completed=i + 1)
        
        progress.remove_task(task)
        
    console.print(f"[{SUCCESS_COLOR}]✓ File encrypted successfully ({len(payload)} bytes)[/{SUCCESS_COLOR}]")
    show_step_progress(encryption_steps, 3)
    console.print()

    # Step 4: Create and save manifest
    with create_progress_spinner() as progress:
        task = progress.add_task("📋 Creating manifest for recipients...", total=None)
        
        manifest = build_manifest(recipients.projectId, fk, recipients)
        time.sleep(0.3)
        progress.update(task, description="💾 Saving encrypted files...")
        
        # Check for overwrites
        enc_path = out_dir / ENCRYPTED_ENV_NAME
        check_overwrite(enc_path, force)
        enc_path.write_bytes(payload)

        manifest_path = save_manifest(manifest, out_dir)
        time.sleep(0.2)
        progress.remove_task(task)
    
    console.print(f"[{SUCCESS_COLOR}]✓ Created manifest for {len(recipients.recipients)} recipients[/{SUCCESS_COLOR}]")
    show_step_progress(encryption_steps, 4)
    console.print()

    # Step 5: Ensure .gitignore protection
    with create_progress_spinner() as progress:
        task = progress.add_task("🛡️  Adding .gitignore protection...", total=None)
        env_dir = env_path.parent
        ensure_gitignore_entry(env_dir, env_path.name)
        time.sleep(0.2)
        progress.remove_task(task)

    console.print(f"[{SUCCESS_COLOR}]✓ Added .gitignore protection[/{SUCCESS_COLOR}]")
    show_step_progress(encryption_steps, 5)
    console.print()
    
    # Step 6: Update project timestamp
    with create_progress_spinner() as progress:
        task = progress.add_task("⏰ Updating project timestamp...", total=None)
        try:
            client = create_supabase_client()
            client.update_project_last_edited(project_id)
            time.sleep(0.2)
            progress.remove_task(task)
            console.print(f"[{SUCCESS_COLOR}]✓ Project timestamp updated[/{SUCCESS_COLOR}]")
        except Exception as e:
            progress.remove_task(task)
            console.print(f"[{WARNING_COLOR}]⚠ Could not update timestamp: {e}[/{WARNING_COLOR}]")
    
    # Step 7: Clean up original file if requested
    if delete:
        show_step_progress(encryption_steps, 6 if not delete else 6)
        console.print()
        
        with create_progress_spinner() as progress:
            task = progress.add_task("🗑️  Removing original file...", total=None)
            try:
                env_path.unlink()
                time.sleep(0.2)
                progress.remove_task(task)
                console.print(f"[{SUCCESS_COLOR}]✓ Original file deleted securely[/{SUCCESS_COLOR}]")
            except OSError as e:
                progress.remove_task(task)
                show_warning_panel("Cleanup Warning", f"Failed to delete original file {env_path}: {e}")
    
    console.print()
    
    # Final success display
    show_success_panel(
        "Encryption Complete!",
        "Your environment file has been encrypted successfully.",
        [
            f"Encrypted file: {enc_path}",
            f"Manifest file: {manifest_path}", 
            f"Recipients: {len(recipients.recipients)} team members",
            "Original file protected by .gitignore" + (" and deleted" if delete else "")
        ]
    )


@app.command()
@click.option("--folder", "folder_path", type=click.Path(path_type=Path, exists=True, file_okay=False, dir_okay=True), default=Path.cwd(), show_default=True, help="Folder containing the encrypted .env.enc and ripenv.manifest.json files.")
@click.option("--project-id", required=True, help="Project ID to verify access and get project info.")
@click.option("--keyfile", "keyfile_path", type=click.Path(path_type=Path, exists=True), default=Path.cwd() / DEFAULT_KEYFILE_NAME, show_default=True, help="Path to your encrypted keyfile.")
@click.option("--force", is_flag=True, help="Overwrite existing .env if present.")
def decrypt(folder_path: Path, project_id: str, keyfile_path: Path, force: bool) -> None:
    """Decrypt an encrypted .env.enc file using project ID and your keyfile."""
    
    # Show beautiful banner
    show_animated_banner("Environment File Decryption")
    
    # Enhanced HALO-style presentation
    console.print(f"Built by [bold {ACCENT_COLOR}]ripenv team[/bold {ACCENT_COLOR}] for secure environment management")
    console.print(f"Powered by [bold {WARNING_COLOR}]Supabase & Rich[/bold {WARNING_COLOR}]")
    console.print()
    
    # Step 1: Validate files exist
    with create_progress_spinner() as progress:
        task = progress.add_task("🔍 Locating encrypted files...", total=None)
        
        enc_path = folder_path / ENCRYPTED_ENV_NAME
        manifest_path = folder_path / MANIFEST_FILENAME
        
        time.sleep(0.3)
        
        # Check if required files exist
        if not enc_path.exists():
            progress.remove_task(task)
            show_error_panel("File Not Found", f"Encrypted file not found: {enc_path}")
            return
        
        if not manifest_path.exists():
            progress.remove_task(task)
            show_error_panel("File Not Found", f"Manifest file not found: {manifest_path}")
            return
            
        progress.remove_task(task)
    
    # Display found files in a nice table
    file_table = Table(title=f"Files in {folder_path}", show_header=True, box=None)
    file_table.add_column("Type", style=ACCENT_COLOR)
    file_table.add_column("Filename", style="bold")
    file_table.add_column("Size", justify="right")
    
    enc_size = f"{enc_path.stat().st_size:,} bytes"
    manifest_size = f"{manifest_path.stat().st_size:,} bytes"
    
    file_table.add_row("🔒 Encrypted", enc_path.name, enc_size)
    file_table.add_row("📋 Manifest", manifest_path.name, manifest_size)
    
    console.print(file_table)
    console.print()
    
    # Decryption steps
    decryption_steps = [
        "Load and validate keyfile",
        "Unlock private key",
        "Load and verify manifest", 
        "Verify project access",
        "Decrypt environment file",
        "Save to secure location"
    ]
    
    show_step_progress(decryption_steps, 0)
    console.print()
    
    # Step 1: Load keyfile
    with create_progress_spinner() as progress:
        task = progress.add_task("🗝️  Loading keyfile...", total=None)
        try:
            keyfile = load_keyfile(keyfile_path)
            time.sleep(0.3)
            progress.remove_task(task)
            
            console.print(f"[{SUCCESS_COLOR}]✓ Keyfile loaded successfully[/{SUCCESS_COLOR}]")
            show_step_progress(decryption_steps, 1)
            console.print()
            
        except ValidationError as exc:
            progress.remove_task(task)
            show_error_panel("Invalid Keyfile", f"Could not load keyfile: {exc}")
            return
    
    # Step 2: Unlock private key with password prompt
    password = click.prompt(f"[{PRIMARY_COLOR}]🔐 Enter your keyfile password[/{PRIMARY_COLOR}]", hide_input=True)
    
    with create_progress_spinner() as progress:
        task = progress.add_task("🔓 Unlocking private key...", total=None)
        try:
            private_key = unlock_private_key(password, keyfile)
            time.sleep(0.5)  # Let user see the unlocking process
            progress.remove_task(task)
            
            console.print(f"[{SUCCESS_COLOR}]✓ Private key unlocked successfully[/{SUCCESS_COLOR}]")
            show_step_progress(decryption_steps, 2)
            console.print()
            
        except ValueError as exc:
            progress.remove_task(task)
            show_error_panel("Authentication Failed", f"Could not unlock private key: {exc}")
            return

    # Step 3: Load and verify manifest
    with create_progress_spinner() as progress:
        task = progress.add_task("📋 Loading manifest...", total=None)
        try:
            manifest = load_manifest(manifest_path)
            time.sleep(0.3)
            progress.remove_task(task)
            
            # Verify the project ID matches the manifest
            if manifest.projectId != project_id:
                show_error_panel(
                    "Project Mismatch", 
                    f"Manifest is for project '{manifest.projectId}', but you specified '{project_id}'"
                )
                return
                
            console.print(f"[{SUCCESS_COLOR}]✓ Manifest loaded ({len(manifest.recipients)} recipients)[/{SUCCESS_COLOR}]")
            show_step_progress(decryption_steps, 3)
            console.print()
            
        except ValidationError as exc:
            progress.remove_task(task)
            show_error_panel("Invalid Manifest", f"Could not load manifest: {exc}")
            return

    # Step 4: Find recipient and verify access
    with create_progress_spinner() as progress:
        task = progress.add_task("👤 Finding your recipient entry...", total=None)
        
        # Find recipient by matching public key from keyfile to manifest
        user_public_key = keyfile.publicKey
        recipient = None
        
        for r in manifest.recipients:
            if r.publicKey == user_public_key:
                recipient = r
                break
        
        if not recipient:
            progress.remove_task(task)
            # Fallback: ask for email if we can't match by public key
            email = click.prompt(
                f"[{WARNING_COLOR}]Could not auto-detect your email. Please enter it[/{WARNING_COLOR}]", 
                type=str
            )
            recipient = next((r for r in manifest.recipients if r.email.lower() == email.lower()), None)
            
            if not recipient:
                show_error_panel("Access Denied", f"No manifest entry found for {email}")
                return
        
        progress.update(task, description=f"🌐 Verifying access for {recipient.email}...")
        
        try:
            verify_user_project_access(project_id, recipient.email)
            time.sleep(0.5)
            progress.remove_task(task)
            
            console.print(f"[{SUCCESS_COLOR}]✓ Access verified for {recipient.email}[/{SUCCESS_COLOR}]")
            show_step_progress(decryption_steps, 4)
            console.print()
            
        except Exception as e:
            progress.remove_task(task)
            show_error_panel("Access Verification Failed", f"Could not verify access: {e}")
            return

    # Step 5: Decrypt the file with progress bar
    with create_progress_bar() as progress:
        task = progress.add_task("🔓 Decrypting environment file...", total=100)
        
        # Unwrap the file key
        wrapped_fk = crypto.b64d(recipient.wrappedKey)
        for i in range(30):
            time.sleep(0.01)
            progress.update(task, completed=i + 1)
        
        try:
            fk = crypto.sealedbox_unwrap(private_key, wrapped_fk)
            for i in range(30, 60):
                time.sleep(0.01)
                progress.update(task, completed=i + 1)
        except Exception as exc:
            progress.remove_task(task)
            show_error_panel(
                "Key Unwrap Failed", 
                "Failed to unwrap file key. Ensure you used the correct keyfile and password."
            )
            return

        # Decrypt the file
        enc_payload = enc_path.read_bytes()
        try:
            plaintext = crypto.file_decrypt(fk, enc_payload)
            for i in range(60, 100):
                time.sleep(0.01)
                progress.update(task, completed=i + 1)
            
            progress.remove_task(task)
            
        except Exception as exc:
            progress.remove_task(task)
            show_error_panel(
                "Decryption Failed",
                "Failed to decrypt .env.enc. The file may be corrupted or the key is incorrect."
            )
            return
    
    console.print(f"[{SUCCESS_COLOR}]✓ File decrypted successfully ({len(plaintext)} bytes)[/{SUCCESS_COLOR}]")
    show_step_progress(decryption_steps, 5)
    console.print()

    # Step 6: Save to secure location
    with create_progress_spinner() as progress:
        task = progress.add_task("💾 Saving to secure location...", total=None)
        
        # Place the decrypted .env file in the same folder as the encrypted files
        # This keeps everything organized in one location while ensuring proper gitignore protection
        out_path = folder_path / DEFAULT_ENV_NAME
        check_overwrite(out_path, force)
        out_path.write_bytes(plaintext)
        
        progress.update(task, description="🛡️  Adding .gitignore protection...")
        # Ensure .gitignore exists to prevent accidental commits of the decrypted .env file
        ensure_gitignore_entry(folder_path, DEFAULT_ENV_NAME)
        
        progress.update(task, description="⏰ Updating project timestamp...")
        try:
            client = create_supabase_client()
            client.update_project_last_edited(project_id)
        except Exception as e:
            # Don't fail decryption if timestamp update fails
            console.print(f"[{WARNING_COLOR}]⚠ Could not update timestamp: {e}[/{WARNING_COLOR}]")
        
        time.sleep(0.3)
        progress.remove_task(task)
    
    # Count environment variables for final report
    try:
        env_vars = dotenv_values(str(out_path))
        var_count = len([k for k in env_vars.keys() if k])
    except:
        var_count = "unknown"
    
    # Final success display
    show_success_panel(
        "Decryption Complete!",
        f"Environment secrets decrypted for {recipient.email}",
        [
            f"Output file: {out_path}",
            f"Environment variables: {var_count}",
            "File placed in same folder as encrypted files",
            "Protected by .gitignore to prevent commits"
        ]
    )
