"""Supabase client for ripenv CLI."""

from __future__ import annotations

import os
from typing import List, Optional

from supabase import create_client, Client
from pydantic import BaseModel, EmailStr

from .types import Recipient


class ProjectMember(BaseModel):
    email: EmailStr
    public_key: Optional[str]


class SupabaseClient:
    def __init__(self):
        self.url = os.getenv("RIPENV_SUPABASE_URL")
        self.key = os.getenv("RIPENV_SUPABASE_ANON_KEY")
        
        if not self.url or not self.key:
            raise ValueError(
                "Missing Supabase credentials. Run 'ripenv configure' to set up your Supabase URL and anon key."
            )
        
        self.client: Client = create_client(self.url, self.key)
    
    def get_project_recipients(self, project_id: str) -> List[Recipient]:
        """Fetch all recipients (project members with public keys) for a project."""
        try:
            response = self.client.table("project_members") \
                .select("email, public_key") \
                .eq("project_id", project_id) \
                .not_.is_("public_key", "null") \
                .execute()
            
            if not response.data:
                # Check if project exists at all
                project_check = self.client.table("projects") \
                    .select("id") \
                    .eq("id", project_id) \
                    .execute()
                
                if not project_check.data:
                    raise ValueError(f"Project '{project_id}' does not exist.")
                else:
                    raise ValueError(f"Project '{project_id}' has no members with public keys. Members need to generate keypairs on the web UI first.")
            
            recipients = []
            for member in response.data:
                recipients.append(Recipient(
                    email=member["email"],
                    publicKey=member["public_key"]
                ))
            
            return recipients
            
        except ValueError:
            raise  # Re-raise our custom messages
        except Exception as exc:
            raise ValueError(f"Failed to fetch project recipients from Supabase: {exc}. Check your RIPENV_SUPABASE_* environment variables.")
    
    def verify_project_access(self, project_id: str, email: str) -> bool:
        """Verify that a user has access to a project."""
        try:
            response = self.client.table("project_members") \
                .select("email") \
                .eq("project_id", project_id) \
                .eq("email", email) \
                .execute()
            
            return len(response.data) > 0
            
        except Exception as exc:
            raise ValueError(f"Failed to verify project access with Supabase: {exc}. Check your RIPENV_SUPABASE_* environment variables.")
    
    def get_project_info(self, project_id: str) -> Optional[dict]:
        """Get basic project information."""
        try:
            response = self.client.table("projects") \
                .select("id, name, owner") \
                .eq("id", project_id) \
                .execute()
            
            return response.data[0] if response.data else None
            
        except Exception as exc:
            raise ValueError(f"Failed to fetch project info: {exc}")
    
    def update_project_last_edited(self, project_id: str) -> None:
        """Update the last_edited_at timestamp for a project."""
        try:
            from datetime import datetime, timezone
            
            response = self.client.table("projects") \
                .update({"last_edited_at": datetime.now(timezone.utc).isoformat()}) \
                .eq("id", project_id) \
                .execute()
            
            if not response.data:
                raise ValueError(f"Failed to update project timestamp. Project '{project_id}' may not exist.")
                
        except ValueError:
            raise  # Re-raise our custom messages
        except Exception as exc:
            # Don't fail the encryption/decryption process if timestamp update fails
            # Just log the error and continue
            import warnings
            warnings.warn(f"Failed to update project timestamp: {exc}")


def create_supabase_client() -> SupabaseClient:
    """Create and return a configured Supabase client."""
    return SupabaseClient()