import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { database } from './firebase';
import { ref, onValue, push, set, get } from 'firebase/database';

export default function QuoteVotingApp() {
  const [quotes, setQuotes] = useState([]);
  const [newQuote, setNewQuote] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const quotesRef = ref(database, 'quotes');
    
    const unsubscribe = onValue(quotesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const quotesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setQuotes(quotesArray);
      } else {
        setQuotes([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newQuote.trim()) {
      const quote = {
        text: newQuote.trim(),
        author: newAuthor.trim() || 'Anonymous',
        votes: 0,
        timestamp: Date.now()
      };

      const quotesRef = ref(database, 'quotes');
      await push(quotesRef, quote);
      
      setNewQuote('');
      setNewAuthor('');
      setShowForm(false);
    }
  };

  const vote = async (id, delta) => {
    const quoteRef = ref(database, `quotes/${id}`);
    const snapshot = await get(quoteRef);
    const currentVotes = snapshot.val()?.votes || 0;
    await set(quoteRef, {
      ...snapshot.val(),
      votes: currentVotes + delta
    });
  };

  const sortedQuotes = [...quotes].sort((a, b) => b.votes - a.votes);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-purple-600 text-2xl mb-4">Loading quotes...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Quottit</h1>
          <p className="text-gray-600">Share your favorite quotes and vote on others</p>
          <p className="text-sm text-green-600 mt-2">🔥 Live - Everyone sees the same quotes!</p>
        </div>
        <div className="mb-6">
          <button onClick={() => setShowForm(!showForm)} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-colors">
            <Plus size={20} />
            Add New Quote
          </button>
        </div>
        {showForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Submit a Quote</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Quote</label>
                <textarea value={newQuote} onChange={(e) => setNewQuote(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" rows="3" placeholder="Enter the quote..." required />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Author (optional)</label>
                <input type="text" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Who said this?" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">Submit Quote</button>
                <button type="button" onClick={() => { setShowForm(false); setNewQuote(''); setNewAuthor(''); }} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        )}
        <div className="space-y-4">
          {sortedQuotes.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center text-gray-500">No quotes yet. Be the first to add one!</div>
          ) : (
            sortedQuotes.map((quote, index) => (
              <div key={quote.id} className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={() => vote(quote.id, 1)} className="p-2 rounded-full hover:bg-green-100 text-gray-600 hover:text-green-600 transition-colors"><ArrowUp size={24} /></button>
                    <div className={`text-xl font-bold ${quote.votes > 0 ? 'text-green-600' : quote.votes < 0 ? 'text-red-600' : 'text-gray-600'}`}>{quote.votes}</div>
                    <button onClick={() => vote(quote.id, -1)} className="p-2 rounded-full hover:bg-red-100 text-gray-600 hover:text-red-600 transition-colors"><ArrowDown size={24} /></button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-3xl text-purple-300 leading-none">"</span>
                      <p className="text-lg text-gray-800 italic pt-1">{quote.text}</p>
                      <span className="text-3xl text-purple-300 leading-none">"</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-gray-600 font-medium">— {quote.author}</p>
                      <span className="text-sm text-gray-400">#{index + 1}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>🔥 Connected to Firebase - Quotes sync in real-time!</p>
        </div>
      </div>
    </div>
  );
}