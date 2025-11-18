// Конфигурация Supabase
const SUPABASE_URL = 'https://xflzsoruvmodqjsfvrwr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbHpzb3J1dm1vZHFqc2Z2cndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzAwMDIsImV4cCI6MjA3OTAwNjAwMn0.CY5Za3yO0QH1x4ChjwvMVn1O9WmZIWF3QkfWoHF7WvU';

// Инициализация Supabase клиента
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);