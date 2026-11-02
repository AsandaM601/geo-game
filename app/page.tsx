"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const initialCountries = [
  { name: "South Africa", soldiers: 5, owner: "You" },
  { name: "India", soldiers: 9, owner: "NPC 1" },
  { name: "China", soldiers: 9, owner: "NPC 2" },
  { name: "USA", soldiers: 9, owner: "NPC 3" },
  { name: "Vatican City", soldiers: 1, owner: "NPC 4" },
  { name: "Brazil", soldiers: 6, owner: "NPC 5" },
  { name: "Australia", soldiers: 3, owner: "NPC 6" },
  { name: "Germany", soldiers: 5, owner: "NPC 7" },
  { name: "Japan", soldiers: 7, owner: "NPC 8" },
  { name: "Russia", soldiers: 9, owner: "NPC 9" },
];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [countries, setCountries] = useState(initialCountries);
  const [selectedAttacker, setSelectedAttacker] = useState<number | null>(0);
  
  const [gameLog, setGameLog] = useState<string[]>(["Game started! It is your turn."]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessingNPCs, setIsProcessingNPCs] = useState(false);

  // Load game from Firestore when user logs in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, "games", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCountries(docSnap.data().countries);
        } else {
          // New player, create initial game in DB
          await setDoc(docRef, { countries: initialCountries });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Helper to save and check win condition
  const updateGameState = async (newCountries: any[], newLogs: string[]) => {
    setCountries(newCountries);
    setGameLog(prev => [...newLogs, ...prev]);
    setIsModalOpen(true);

    if (user) {
      await setDoc(doc(db, "games", user.uid), { countries: newCountries });
    }

    // WIN CONDITION CHECK
    const playerCountries = newCountries.filter(c => c.owner === "You").length;
    if (playerCountries === 10) {
      setTimeout(() => alert("🏆 CONGRATULATIONS! You have conquered the world and won the game!"), 500);
    } else if (playerCountries === 0) {
      setTimeout(() => alert("💀 GAME OVER. You have been eliminated."), 500);
    }
  };

  const handleAttack = (defenderIndex: number) => {
    if (isProcessingNPCs) return alert("Wait for NPCs to finish their turns!");
    if (selectedAttacker === null) return alert("Select one of your countries first!");
    
    const attacker = countries[selectedAttacker];
    const defender = countries[defenderIndex];

    if (attacker.owner !== "You") return alert("You can only attack from your own country!");
    if (defender.owner === "You") return alert("You cannot attack yourself!");
    if (attacker.soldiers < 2) return alert("You need at least 2 soldiers to attack!");

    const diceCount = Math.min(attacker.soldiers - 1, defender.soldiers);
    const attackerRolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a);
    const defenderRolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a);

    let attackerLosses = 0;
    let defenderLosses = 0;
    let logs: string[] = [`⚔️ You attacked ${defender.name}!`];

    for (let i = 0; i < diceCount; i++) {
      if (attackerRolls[i] > defenderRolls[i]) defenderLosses++;
      else if (defenderRolls[i] > attackerRolls[i]) attackerLosses++;
    }

    const newCountries = [...countries];
    newCountries[selectedAttacker].soldiers -= attackerLosses;
    newCountries[defenderIndex].soldiers -= defenderLosses;

    if (newCountries[defenderIndex].soldiers <= 0) {
      newCountries[defenderIndex].owner = "You";
      const gained = Math.max(2, Math.floor(defender.soldiers / 2));
      newCountries[defenderIndex].soldiers = gained;
      logs.push(`🏆 VICTORY! You conquered ${defender.name}!`);
    } else {
      logs.push(`Defender lost ${defenderLosses}, You lost ${attackerLosses}.`);
    }

    updateGameState(newCountries, logs);
  };

  const handleEndTurn = async () => {
    setIsProcessingNPCs(true);
    let currentCountries = [...countries];
    let turnLogs: string[] = ["⏳ Processing NPC turns..."];

    const playerCountries = currentCountries.filter(c => c.owner === "You").length;
    if (playerCountries === 0) {
      turnLogs.push("💀 You have been eliminated!");
      updateGameState(currentCountries, turnLogs);
      setIsProcessingNPCs(false);
      return;
    }

    for (let i = 1; i <= 9; i++) {
      const npcName = `NPC ${i}`;
      const npcOwnedIndices = currentCountries.map((c, idx) => c.owner === npcName ? idx : -1).filter(idx => idx !== -1);
      
      if (npcOwnedIndices.length === 0) continue;

      const reinforcements = npcOwnedIndices.length * 2;
      let strongestIdx = npcOwnedIndices[0];
      npcOwnedIndices.forEach(idx => {
        if (currentCountries[idx].soldiers > currentCountries[strongestIdx].soldiers) strongestIdx = idx;
      });
      currentCountries[strongestIdx].soldiers += reinforcements;

      if (currentCountries[strongestIdx].soldiers > 2) {
        let weakestEnemyIdx = -1;
        let lowestSoldiers = 999;
        currentCountries.forEach((c, idx) => {
          if (c.owner !== npcName && c.soldiers < lowestSoldiers) {
            lowestSoldiers = c.soldiers;
            weakestEnemyIdx = idx;
          }
        });

        if (weakestEnemyIdx !== -1) {
          const attacker = currentCountries[strongestIdx];
          const defender = currentCountries[weakestEnemyIdx];
          const diceCount = Math.min(attacker.soldiers - 1, defender.soldiers);
          
          let aLoss = 0, dLoss = 0;
          for (let d = 0; d < diceCount; d++) {
            const aRoll = Math.floor(Math.random() * 6) + 1;
            const dRoll = Math.floor(Math.random() * 6) + 1;
            if (aRoll > dRoll) dLoss++;
            else if (dRoll > aRoll) aLoss++;
          }

          attacker.soldiers -= aLoss;
          defender.soldiers -= dLoss;

          if (defender.soldiers <= 0) {
            defender.owner = npcName;
            defender.soldiers = Math.max(2, Math.floor(defender.soldiers / 2));
            turnLogs.push(`🤖 ${npcName} conquered ${defender.name}!`);
          } else {
            turnLogs.push(`🤖 ${npcName} attacked ${defender.name} (lost ${aLoss} vs ${dLoss}).`);
          }
        }
      }
    }

    turnLogs.push("✅ NPC turns complete. It is your turn!");
    updateGameState(currentCountries, turnLogs);
    setIsProcessingNPCs(false);
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading game...</div>;

  if (user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 relative">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-yellow-500">Geopolitics Game</h1>
          <div className="flex items-center gap-4">
            <p>Player: {user.email}</p>
            
            <button 
              onClick={handleEndTurn} 
              disabled={isProcessingNPCs}
              className={`px-4 py-2 rounded font-bold transition ${isProcessingNPCs ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}
            >
              {isProcessingNPCs ? "NPCs Moving..." : "End Turn (Simulate NPCs)"}
            </button>

            {/* NEW GAME BUTTON */}
            <button 
              onClick={async () => {
                if(confirm("Are you sure you want to start a new game?")) {
                  if (user) await setDoc(doc(db, "games", user.uid), { countries: initialCountries });
                  window.location.reload();
                }
              }} 
              className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-500 transition"
            >
              New Game
            </button>

            <button onClick={() => signOut(auth)} className="bg-red-600 px-4 py-2 rounded hover:bg-red-700">
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {countries.map((country, index) => (
            <div 
              key={index} 
              onClick={() => country.owner === "You" && !isProcessingNPCs && setSelectedAttacker(index)}
              className={`p-4 rounded-lg border-2 flex flex-col items-center shadow-lg cursor-pointer transition-all ${
                selectedAttacker === index ? "border-yellow-500 bg-gray-700 scale-105" : "border-gray-700 bg-gray-800"
              }`}
            >
              <h2 className="text-xl font-semibold mb-2">{country.name}</h2>
              <div className="text-4xl mb-2">🛡️</div>
              <p className="text-lg text-green-400">{country.soldiers} Soldiers</p>
              <p className={`text-sm mt-2 font-bold ${country.owner === "You" ? "text-blue-400" : "text-red-400"}`}>
                {country.owner}
              </p>
              {country.owner !== "You" && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleAttack(index); }}
                  disabled={isProcessingNPCs}
                  className="mt-4 bg-red-600 hover:bg-red-700 w-full py-2 rounded transition disabled:opacity-50"
                >
                  Attack
                </button>
              )}
            </div>
          ))}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-gray-800 p-6 rounded-lg max-w-lg w-full border border-gray-600 shadow-2xl">
              <h2 className="text-2xl font-bold mb-4 text-yellow-500">Game Log</h2>
              <div className="bg-gray-900 p-4 rounded h-64 overflow-y-auto mb-4 font-mono text-sm space-y-2">
                {gameLog.map((log, i) => (
                  <p key={i}>{log}</p>
                ))}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="bg-blue-600 hover:bg-blue-700 w-full py-2 rounded font-bold">
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="p-8 bg-gray-800 rounded-lg shadow-xl w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {isLogin ? "Login to Geopolitics" : "Create an Account"}
        </h1>
        
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500" required />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2 transition">
            {isLogin ? "Login" : "Sign Up"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-blue-400 hover:underline">
            {isLogin ? "Sign up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}