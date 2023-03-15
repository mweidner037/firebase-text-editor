// Import the functions you need from the SDKs you need
import { FirebaseOptions, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getDatabase,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  update,
} from "firebase/database";
import { Cursors, PositionSource } from "position-strings";

(async function () {
  // Initialize Firebase
  const configEnv = process.env.FIREBASE_CONFIG;
  if (!configEnv) {
    throw new Error("FIREBASE_CONFIG not set");
  }
  const firebaseConfig = <FirebaseOptions>JSON.parse(configEnv);
  const app = initializeApp(firebaseConfig);
  await signInAnonymously(getAuth(app));

  const db = getDatabase(app);
  const textRef = ref(db, "text/");

  const textarea = document.getElementById("textarea") as HTMLTextAreaElement;
  const posSource = new PositionSource();

  // Text query. The current text's sorted pos's and keys are cached in
  // positions and keys, resp.
  let positions: string[] = [];
  let keys: string[] = [];
  const textQuery = query(textRef, orderByChild("pos"));
  onValue(textQuery, (snapshot) => {
    const chars: string[] = [];
    positions = [];
    keys = [];
    snapshot.forEach((child) => {
      keys.push(child.key!);
      const val = child.val();
      chars.push(val.data);
      positions.push(val.pos);
    });
    textarea.value = chars.join("");
    updateSelection();
  });

  // Cursors.
  let myStartCursor = Cursors.fromIndex(0, positions);
  let myEndCursor = Cursors.fromIndex(0, positions);

  function updateCursors() {
    // Need to do this on a delay because the event doesn't
    // due its default action (updating the handler) until
    // after the event handlers.
    setTimeout(() => {
      myStartCursor = Cursors.fromIndex(textarea.selectionStart, positions);
      myEndCursor = Cursors.fromIndex(textarea.selectionEnd, positions);
    }, 0);
  }

  function updateSelection() {
    textarea.selectionStart = Cursors.toIndex(myStartCursor, positions);
    textarea.selectionEnd = Cursors.toIndex(myEndCursor, positions);
  }

  window.addEventListener("selectionchange", updateCursors);
  textarea.addEventListener("mousedown", updateCursors);
  textarea.addEventListener("mousemove", (e) => {
    if (e.buttons === 1) updateCursors();
  });
  textarea.addEventListener("mouseclick", updateCursors);

  // Change the text when a key is pressed in textarea
  textarea.addEventListener("keydown", (e) => {
    const startIndex = Cursors.toIndex(myStartCursor, positions);
    const endIndex = Cursors.toIndex(myEndCursor, positions);
    if (e.key === "Backspace") {
      if (endIndex > startIndex) {
        textDelete(startIndex, endIndex - startIndex);
        myEndCursor = Cursors.fromIndex(startIndex, positions);
      } else if (endIndex === startIndex && startIndex > 0) {
        textDelete(startIndex - 1);
        myStartCursor = Cursors.fromIndex(startIndex - 1, positions);
      }
    } else if (e.key === "Delete") {
      if (endIndex > startIndex) {
        textDelete(startIndex, endIndex - startIndex);
        myEndCursor = Cursors.fromIndex(startIndex, positions);
      } else if (
        endIndex === startIndex &&
        startIndex < textarea.value.length
      ) {
        textDelete(startIndex);
      }
    } else if (e.key === "Enter") {
      type("\n", startIndex, endIndex);
    } else if (e.key === "Tab") {
      // Proper tab behavior?
      type("    ", startIndex, endIndex);
    } else if (shouldType(e)) {
      type(e.key, startIndex, endIndex);
    } else {
      // Assume it's either irrelevant or selection related
      updateCursors();
      return; // Don't updateSelection or preventDefault.
      // Ctrl+V, Ctrl+X dispatch paste/cut events, like when
      // using the mouse menu versions, which we handle below.
      // Ctrl+C doesn't need to be handled (default works fine.)
      // So we don't need cases for these.
    }

    updateSelection();
    // Don't let the browser type the key, we do it for them
    e.preventDefault();
  });

  function type(str: string, startIndex: number, endIndex: number) {
    if (startIndex < endIndex) {
      // Delete current selection
      textDelete(startIndex, endIndex - startIndex);
    }
    textInsert(startIndex, str);
    myStartCursor = Cursors.fromIndex(startIndex + str.length, positions);
    myEndCursor = Cursors.fromIndex(startIndex + str.length, positions);
  }

  function shouldType(e: KeyboardEvent): boolean {
    return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
  }

  function textInsert(index: number, str: string) {
    // For bulk inserts, each push() (per char) will update the state
    // immediately. To prevent indices from getting confused, generate all
    // the positions before pushing anything.
    // OPT: integrate with createBetween.
    const newPositions: string[] = [];
    let before = positions[index - 1];
    const after = positions[index];
    for (let i = 0; i < str.length; i++) {
      const newPos = posSource.createBetween(before, after);
      newPositions.push(newPos);
      before = newPos;
    }

    for (let i = 0; i < str.length; i++) {
      push(textRef, { pos: newPositions[i], data: str.charAt(i) });
    }
  }

  function textDelete(start: number, count = 1) {
    const updateArg: { [key: string]: null } = {};
    for (let i = 0; i < count; i++) {
      updateArg[keys[start + i]] = null;
    }
    update(textRef, updateArg);
  }

  textarea.addEventListener("paste", (e) => {
    if (e.clipboardData) {
      const pasted = e.clipboardData.getData("text");
      type(
        pasted,
        Cursors.toIndex(myStartCursor, positions),
        Cursors.toIndex(myEndCursor, positions)
      );
      updateSelection();
    }
    e.preventDefault();
  });

  textarea.addEventListener("cut", () => {
    const startIndex = Cursors.toIndex(myStartCursor, positions);
    const endIndex = Cursors.toIndex(myEndCursor, positions);
    if (startIndex < endIndex) {
      const selected = textarea.value.slice(startIndex, endIndex);
      navigator.clipboard.writeText(selected);
      textDelete(startIndex, endIndex - startIndex);
    }
  });

  // Allow drag+drop text?  Currently we just
  // disable it.
  textarea.addEventListener("dragstart", (e) => {
    e.preventDefault();
  });
  textarea.addEventListener("drop", (e) => {
    e.preventDefault();
  });
})();
