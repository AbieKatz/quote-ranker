import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Plus, Search, MessageSquare, Share2, User, LogOut, LogIn, ChevronDown, ChevronRight, Send, X } from 'lucide-react';
import { database } from './firebase';
import { ref, onValue, push, set, get } from 'firebase/database';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';

export default function QuoteVotingApp() {
  const [quotes, setQuotes] = useState([]);
  const [newQuote, setNewQuote] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newTags, setNewTags] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('');
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [viewMode, setViewMode] = useState('all');
  const [expandedQuote, setExpandedQuote] = useState(null);
  const [comments, setComments] = useState({});
  const [collapsedComments, setCollapsedComments] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);

  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Check if user has a profile
        const profileRef = ref(database, `users/${currentUser.uid}`);
        const snapshot = await get(profileRef);
        
        if (snapshot.exists()) {
          setUserProfile(snapshot.val());
        } else {
          // New user - show username modal
          setShowUsernameModal(true);
          setUsernameInput(currentUser.displayName || '');
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

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

  useEffect(() => {
    if (!expandedQuote) return;

    const commentsRef = ref(database, `comments/${expandedQuote}`);
    const unsubscribe = onValue(commentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const commentsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setComments(prev => ({ ...prev, [expandedQuote]: commentsArray }));
      } else {
        setComments(prev => ({ ...prev, [expandedQuote]: [] }));
      }
    });

    return () => unsubscribe();
  }, [expandedQuote]);

  const allTags = [...new Set(quotes.flatMap(q => 
    q.tags ? q.tags.split(',').map(t => t.trim()) : []
  ))].sort();
  
  const allAuthors = [...new Set(quotes.map(q => q.author))].sort();

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setShowProfileMenu(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const saveUsername = async () => {
    if (!usernameInput.trim() || !user) return;
    
    const profile = {
      username: usernameInput.trim(),
      email: user.email,
      photoURL: user.photoURL,
      createdAt: Date.now()
    };
    
    const userRef = ref(database, `users/${user.uid}`);
    await set(userRef, profile);
    
    setUserProfile(profile);
    setShowUsernameModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newQuote.trim()) {
      const quote = {
        text: newQuote.trim(),
        author: newAuthor.trim() || 'Anonymous',
        source: newSource.trim() || '',
        tags: newTags.trim() || '',
        votes: 0,
        timestamp: Date.now(),
        submittedBy: user && userProfile ? {
          uid: user.uid,
          username: userProfile.username,
          photoURL: user.photoURL
        } : null
      };

      const quotesRef = ref(database, 'quotes');
      await push(quotesRef, quote);
      
      setNewQuote('');
      setNewAuthor('');
      setNewSource('');
      setNewTags('');
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

  const voteComment = async (quoteId, commentId, delta) => {
    const commentRef = ref(database, `comments/${quoteId}/${commentId}`);
    const snapshot = await get(commentRef);
    const currentVotes = snapshot.val()?.votes || 0;
    await set(commentRef, {
      ...snapshot.val(),
      votes: currentVotes + delta
    });
  };

  const shareQuote = async (quote) => {
    const text = `"${quote.text}" — ${quote.author}`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url: window.location.href });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(text);
      alert('Quote copied to clipboard!');
    }
  };

  const submitComment = async (quoteId, textareaId, parentId = null) => {
    if (!user || !userProfile) {
      alert('Please sign in to comment');
      return;
    }
    
    const textarea = document.getElementById(textareaId);
    const text = textarea.value;
    
    if (!text.trim()) return;

    const comment = {
      text: text.trim(),
      author: {
        uid: user.uid,
        username: userProfile.username,
        photoURL: user.photoURL
      },
      timestamp: Date.now(),
      votes: 0,
      parentId: parentId
    };

    const commentsRef = ref(database, `comments/${quoteId}`);
    await push(commentsRef, comment);
    
    textarea.value = '';
    setReplyingTo(null);
  };

  const toggleCollapse = (commentId) => {
    setCollapsedComments(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const buildCommentTree = (quoteId) => {
    const quoteComments = comments[quoteId] || [];
    const commentMap = {};
    const rootComments = [];

    quoteComments.forEach(comment => {
      commentMap[comment.id] = { ...comment, replies: [] };
    });

    quoteComments.forEach(comment => {
      if (comment.parentId && commentMap[comment.parentId]) {
        commentMap[comment.parentId].replies.push(commentMap[comment.id]);
      } else {
        rootComments.push(commentMap[comment.id]);
      }
    });

    const sortByVotes = (a, b) => (b.votes || 0) - (a.votes || 0);
    rootComments.sort(sortByVotes);
    Object.values(commentMap).forEach(comment => {
      comment.replies.sort(sortByVotes);
    });

    return rootComments;
  };

  const CommentThread = ({ comment, quoteId, depth = 0 }) => {
    const isCollapsed = collapsedComments[comment.id];
    const replyCount = comment.replies?.length || 0;
    const timeAgo = getTimeAgo(comment.timestamp);
    const replyTextareaId = `reply-${comment.id}`;

    return (
      <div className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''} mb-4`}>
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => voteComment(quoteId, comment.id, 1)}
              className="text-gray-400 hover:text-green-600"
            >
              <ArrowUp size={16} />
            </button>
            <span className={`text-xs font-medium ${comment.votes > 0 ? 'text-green-600' : 'text-gray-500'}`}>
              {comment.votes || 0}
            </span>
            <button
              onClick={() => voteComment(quoteId, comment.id, -1)}
              className="text-gray-400 hover:text-red-600"
            >
              <ArrowDown size={16} />
            </button>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {comment.author.photoURL && (
                <img src={comment.author.photoURL} className="w-5 h-5 rounded-full" alt="" />
              )}
              <span className="text-sm font-medium text-gray-700">{comment.author.username}</span>
              <span className="text-xs text-gray-400">{timeAgo}</span>
              {replyCount > 0 && (
                <button
                  onClick={() => toggleCollapse(comment.id)}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  {isCollapsed && `[${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}]`}
                </button>
              )}
            </div>

            {!isCollapsed && (
              <>
                <p className="text-sm text-gray-800 mb-2 whitespace-pre-wrap">{comment.text}</p>
                
                <button
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="text-xs text-purple-600 hover:text-purple-700"
                >
                  reply
                </button>

                {replyingTo === comment.id && (
                  <div className="mt-3">
                    <textarea
                      id={replyTextareaId}
                      key={replyTextareaId}
                      placeholder="Write a reply..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows="3"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => submitComment(quoteId, replyTextareaId, comment.id)}
                        className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {!isCollapsed && comment.replies && comment.replies.length > 0 && (
                  <div className="mt-3">
                    {comment.replies.map(reply => (
                      <CommentThread
                        key={reply.id}
                        comment={reply}
                        quoteId={quoteId}
                        depth={depth + 1}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const filteredQuotes = quotes.filter(quote => {
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const matchesSearch = 
        quote.text.toLowerCase().includes(search) ||
        quote.author.toLowerCase().includes(search) ||
        (quote.tags && quote.tags.toLowerCase().includes(search)) ||
        (quote.source && quote.source.toLowerCase().includes(search));
      if (!matchesSearch) return false;
    }

    if (filterTag && (!quote.tags || !quote.tags.includes(filterTag))) {
      return false;
    }

    if (filterAuthor && quote.author !== filterAuthor) {
      return false;
    }

    if (viewMode === 'myQuotes' && user) {
      if (!quote.submittedBy || quote.submittedBy.uid !== user.uid) {
        return false;
      }
    }

    return true;
  });

  const sortedQuotes = [...filteredQuotes].sort((a, b) => b.votes - a.votes);

  const getQuoteOfTheDay = () => {
    if (quotes.length === 0) return null;
    const today = new Date().toDateString();
    const hash = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return quotes[hash % quotes.length];
  };

  const quoteOfTheDay = getQuoteOfTheDay();

  const clearFilters = () => {
    setSearchQuery('');
    setFilterTag('');
    setFilterAuthor('');
  };

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
      <div className="max-w-4xl mx-auto">
        {/* Username Modal */}
        {showUsernameModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  {userProfile ? 'Edit Display Name' : 'Choose Your Display Name'}
                </h2>
              </div>
              <p className="text-gray-600 mb-6">
                {userProfile 
                  ? 'Update how others see you on Quottit.'
                  : 'This is how others will see you. You can use your real name or a pseudonym.'}
              </p>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter display name..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-6"
                onKeyPress={(e) => e.key === 'Enter' && saveUsername()}
                autoFocus
              />
              <button
                onClick={saveUsername}
                disabled={!usernameInput.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {userProfile ? 'Update Username' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Quottit</h1>
            <p className="text-gray-600">Discover wisdom, one quote at a time</p>
            <p className="text-sm text-green-600 mt-2">🔥 Live - {quotes.length} quotes</p>
          </div>
          
          <div className="relative">
            {user && userProfile ? (
              <div>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/50 transition-colors"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={userProfile.username} className="w-10 h-10 rounded-full" />
                  ) : (
                    <User size={24} className="text-gray-600" />
                  )}
                </button>
                
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg p-4 z-10">
                    <div className="mb-4">
                      <p className="font-semibold text-gray-800">{userProfile.username}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setViewMode('myQuotes');
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg mb-2"
                    >
                      My Quotes
                    </button>
                    <button
                      onClick={() => {
                        setUsernameInput(userProfile.username);
                        setShowUsernameModal(true);
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg mb-2"
                    >
                      Edit Username
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <LogOut size={18} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-md"
              >
                <LogIn size={18} />
                Sign In
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'all' 
                ? 'bg-purple-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            All Quotes
          </button>
          <button
            onClick={() => setViewMode('qotd')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'qotd' 
                ? 'bg-purple-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Quote of the Day
          </button>
          {user && userProfile && (
            <button
              onClick={() => setViewMode('myQuotes')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'myQuotes' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              My Quotes
            </button>
          )}
        </div>

        {viewMode === 'qotd' && quoteOfTheDay && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">✨ Quote of the Day</h2>
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg shadow-2xl p-8 text-white">
              <div className="flex items-start gap-2 mb-4">
                <span className="text-5xl text-white/30 leading-none">"</span>
                <p className="text-2xl font-light italic pt-2">{quoteOfTheDay.text}</p>
                <span className="text-5xl text-white/30 leading-none">"</span>
              </div>
              <div className="flex items-center justify-between mt-6">
                <p className="text-xl font-medium">— {quoteOfTheDay.author}</p>
                <div className="flex gap-4">
                  <button
                    onClick={() => vote(quoteOfTheDay.id, 1)}
                    className="p-3 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <ArrowUp size={24} />
                  </button>
                  <div className="text-2xl font-bold">{quoteOfTheDay.votes}</div>
                  <button
                    onClick={() => vote(quoteOfTheDay.id, -1)}
                    className="p-3 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <ArrowDown size={24} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode !== 'qotd' && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search quotes..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>

              <select
                value={filterAuthor}
                onChange={(e) => setFilterAuthor(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Authors</option>
                {allAuthors.map(author => (
                  <option key={author} value={author}>{author}</option>
                ))}
              </select>
            </div>

            {(searchQuery || filterTag || filterAuthor) && (
              <button
                onClick={clearFilters}
                className="mt-4 text-sm text-purple-600 hover:text-purple-700"
              >
                Clear all filters
              </button>
            )}

            <p className="mt-4 text-sm text-gray-600">
              Showing {sortedQuotes.length} of {quotes.length} quotes
            </p>
          </div>
        )}

        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Add New Quote
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Submit a Quote</h2>
            {!user && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  💡 Sign in to get credit for your quotes and build your profile!
                </p>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Quote *</label>
                <textarea
                  value={newQuote}
                  onChange={(e) => setNewQuote(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="3"
                  placeholder="Enter the quote..."
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Author</label>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Who said this?"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Source</label>
                <input
                  type="text"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Book, speech, article..."
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Tags</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="stoicism, motivation, life..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Submit Quote
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setNewQuote('');
                    setNewAuthor('');
                    setNewSource('');
                    setNewTags('');
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {viewMode !== 'qotd' && (
          <div className="space-y-4">
            {sortedQuotes.length === 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center text-gray-500">
                {viewMode === 'myQuotes' 
                  ? "You haven't submitted any quotes yet. Add your first quote above!"
                  : "No quotes found. Try adjusting your filters or add a new quote!"}
              </div>
            ) : (
              sortedQuotes.map((quote, index) => {
                const isExpanded = expandedQuote === quote.id;
                const commentCount = (comments[quote.id] || []).length;
                const mainTextareaId = `comment-main-${quote.id}`;

                return (
                  <div
                    key={quote.id}
                    className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
                  >
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center gap-2">
                        <button
                          onClick={() => vote(quote.id, 1)}
                          className="p-2 rounded-full hover:bg-green-100 text-gray-600 hover:text-green-600 transition-colors"
                        >
                          <ArrowUp size={24} />
                        </button>
                        <div className={`text-xl font-bold ${quote.votes > 0 ? 'text-green-600' : quote.votes < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {quote.votes}
                        </div>
                        <button
                          onClick={() => vote(quote.id, -1)}
                          className="p-2 rounded-full hover:bg-red-100 text-gray-600 hover:text-red-600 transition-colors"
                        >
                          <ArrowDown size={24} />
                        </button>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-3xl text-purple-300 leading-none">"</span>
                          <p className="text-lg text-gray-800 italic pt-1">{quote.text}</p>
                          <span className="text-3xl text-purple-300 leading-none">"</span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-gray-600 font-medium">— {quote.author}</p>
                          {quote.source && (
                            <p className="text-sm text-gray-500 italic">From: {quote.source}</p>
                          )}
                          {quote.tags && (
                            <p className="text-xs text-purple-600">🏷️ {quote.tags}</p>
                          )}
                          <div className="flex items-center gap-4 pt-2">
                            <span className="text-sm text-gray-400">#{index + 1}</span>
                            <button
                              onClick={() => setExpandedQuote(isExpanded ? null : quote.id)}
                              className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                            >
                              <MessageSquare size={16} />
                              {commentCount > 0 ? `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}` : 'discuss'}
                            </button>
                            <button
                              onClick={() => shareQuote(quote)}
                              className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                            >
                              <Share2 size={16} />
                              Share
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-6 pt-6 border-t border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                              Discussion {commentCount > 0 && `(${commentCount})`}
                            </h3>

                            {user && userProfile ? (
                              <div className="mb-6">
                                <textarea
                                  id={mainTextareaId}
                                  key={mainTextareaId}
                                  placeholder="Share your thoughts..."
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  rows="3"
                                />
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => submitComment(quote.id, mainTextareaId)}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                  >
                                    <Send size={16} />
                                    Comment
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                                <p className="text-sm text-gray-600 mb-2">Sign in to join the discussion</p>
                                <button
                                  onClick={handleSignIn}
                                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                                >
                                  Sign In
                                </button>
                              </div>
                            )}

                            {commentCount > 0 ? (
                              <div className="space-y-4">
                                {buildCommentTree(quote.id).map(comment => (
                                  <CommentThread
                                    key={comment.id}
                                    comment={comment}
                                    quoteId={quote.id}
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 text-center py-8">
                                No comments yet. Be the first to share your thoughts!
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>🔥 Built with passion • {quotes.length} quotes and counting</p>
        </div>
      </div>
    </div>
  );
}