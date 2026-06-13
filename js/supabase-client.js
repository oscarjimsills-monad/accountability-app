/**
 * Supabase Client
 * Initializes the Supabase connection
 */

const SUPABASE_URL = 'https://lvtbgfmwefrsctacedsm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dGJnZm13ZWZyc2N0YWNlZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTY3OTQsImV4cCI6MjA5Njc3Mjc5NH0.yj7PuP-Ow7dltFG8wLH83IcfhSesaiHNzaiXmqSvkx4';

const SupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.SupabaseClient = SupabaseClient;
