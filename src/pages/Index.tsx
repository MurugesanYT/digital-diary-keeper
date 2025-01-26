import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// Define allowed users with proper email format and minimum 6 character passwords
const ALLOWED_USERS = {
  'Kabilan': {
    password: 'Kabilan_M123',  // Added "123" to meet minimum length
    email: 'kabilan.diary@example.com'
  },
  'Afrin_Tabassum': {
    password: 'Harry James Potter',  // Already meets minimum length
    email: 'afrin.diary@example.com'
  },
  'Admin': {
    password: 'Admin123',  // Added "123" to meet minimum length
    email: 'admin.diary@example.com'
  }
};

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [entries, setEntries] = useState([]);
  const [content, setContent] = useState("");
  const [date, setDate] = useState(new Date());
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkIfAdmin(session.user.id);
        loadEntries(new Date());
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkIfAdmin(session.user.id);
        loadEntries(new Date());
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkIfAdmin = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();
    
    if (data) {
      setIsAdmin(data.is_admin);
    }
  };

  const loadEntries = async (selectedDate) => {
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    let query = supabase
      .from('diary_entries')
      .select('*')
      .gte('created_at', `${formattedDate}T00:00:00`)
      .lte('created_at', `${formattedDate}T23:59:59`);

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Error loading entries",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setEntries(data || []);
  };

  const saveEntry = async () => {
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Entry cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from('diary_entries')
      .insert([
        {
          content,
          user_id: session.user.id,
        },
      ]);

    if (error) {
      toast({
        title: "Error saving entry",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Entry saved successfully",
    });

    setContent("");
    loadEntries(date);
  };

  const deleteEntry = async (id) => {
    const { error } = await supabase
      .from('diary_entries')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error deleting entry",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Entry deleted successfully",
    });

    loadEntries(date);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const username = e.target.email.value;
    const password = e.target.password.value;

    // Check if credentials match allowed users
    if (!ALLOWED_USERS[username] || ALLOWED_USERS[username].password !== password) {
      toast({
        title: "Error signing in",
        description: "Invalid credentials",
        variant: "destructive",
      });
      return;
    }

    try {
      // First try to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: ALLOWED_USERS[username].email,
        password: password,
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        // If sign in fails, try to create the account
        const { error: signUpError } = await supabase.auth.signUp({
          email: ALLOWED_USERS[username].email,
          password: password,
        });

        if (signUpError) {
          console.error('Sign up error:', signUpError);
          toast({
            title: "Error creating account",
            description: signUpError.message,
            variant: "destructive",
          });
          return;
        }

        // After successful signup, try signing in again
        const { error: finalSignInError } = await supabase.auth.signInWithPassword({
          email: ALLOWED_USERS[username].email,
          password: password,
        });

        if (finalSignInError) {
          console.error('Final sign in error:', finalSignInError);
          toast({
            title: "Error signing in",
            description: finalSignInError.message,
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Success",
        description: "Signed in successfully",
      });
    } catch (error) {
      console.error('Authentication error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-700">
        <Card className="w-[350px] p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-2xl font-bold text-center">Login</h2>
            <Input name="email" type="text" placeholder="Username" required />
            <Input name="password" type="password" placeholder="Password" required />
            <Button type="submit" className="w-full">Login</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Digital Diary</h1>
        <Button variant="destructive" onClick={handleLogout}>Logout</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">New Entry</h2>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write about your day..."
              className="min-h-[200px] mb-4"
            />
            <Button onClick={saveEntry}>Save Entry</Button>
          </Card>
        </div>

        <div>
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">View Entries</h2>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(newDate) => {
                if (newDate) {
                  setDate(newDate);
                  loadEntries(newDate);
                }
              }}
              className="mb-4"
            />
            <div className="space-y-4">
              {entries.map((entry) => (
                <Card key={entry.id} className="p-4">
                  <div dangerouslySetInnerHTML={{ __html: entry.content }} />
                  <div className="flex justify-end mt-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteEntry(entry.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
              {entries.length === 0 && (
                <p className="text-center text-gray-500">No entries for this date</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
