// Import the functions you need from the SDKs you need
import { FirebaseOptions, initializeApp } from "firebase/app";
import {
  getDatabase,
  query,
  ref,
  orderByChild,
  onValue,
  update,
  push,
} from "firebase/database";
import { Position, PositionSource } from "./position_source";

(async function () {
  // Initialize Firebase
  const configEnv = process.env.FIREBASE_CONFIG;
  if (!configEnv) {
    throw new Error("FIREBASE_CONFIG not set");
  }
  const firebaseConfig = <FirebaseOptions>JSON.parse(configEnv);
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  const textRef = ref(db, "text/");

  const textarea = document.getElementById("textarea") as HTMLTextAreaElement;
  const posSource = new PositionSource();

  // Text query. The current text's sorted pos's and keys are cached in
  // positions and keys, resp.
  let positions: Position[] = [];
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
  let myStartCursor = posSource.cursor(positions, 0);
  let myEndCursor = posSource.cursor(positions, 0);

  function updateCursors() {
    // Need to do this on a delay because the event doesn't
    // due its default action (updating the handler) until
    // after the event handlers.
    setTimeout(() => {
      myStartCursor = posSource.cursor(positions, textarea.selectionStart);
      myEndCursor = posSource.cursor(positions, textarea.selectionEnd);
    }, 0);
  }

  function updateSelection() {
    textarea.selectionStart = posSource.index(positions, myStartCursor);
    textarea.selectionEnd = posSource.index(positions, myEndCursor);
  }

  window.addEventListener("selectionchange", updateCursors);
  textarea.addEventListener("mousedown", updateCursors);
  textarea.addEventListener("mousemove", (e) => {
    if (e.buttons === 1) updateCursors();
  });
  textarea.addEventListener("mouseclick", updateCursors);

  // Change the text when a key is pressed in textarea
  textarea.addEventListener("keydown", (e) => {
    const startIndex = posSource.index(positions, myStartCursor);
    const endIndex = posSource.index(positions, myEndCursor);
    if (e.key === "Backspace") {
      if (endIndex > startIndex) {
        textDelete(startIndex, endIndex - startIndex);
        myEndCursor = posSource.cursor(positions, startIndex);
      } else if (endIndex === startIndex && startIndex > 0) {
        textDelete(startIndex - 1);
        myStartCursor = posSource.cursor(positions, startIndex - 1);
      }
    } else if (e.key === "Delete") {
      if (endIndex > startIndex) {
        textDelete(startIndex, endIndex - startIndex);
        myEndCursor = posSource.cursor(positions, startIndex);
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
    myStartCursor = posSource.cursor(positions, startIndex + str.length);
    myEndCursor = posSource.cursor(positions, startIndex + str.length);
  }

  function shouldType(e: KeyboardEvent): boolean {
    return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
  }

  function textInsert(index: number, str: string) {
    // For bulk inserts, each push() (per char) will update the state
    // immediately. To prevent indices from getting confused, generate all
    // the positions before pushing anything.
    // OPT: integrate with createBetween.
    const newPositions: Position[] = [];
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
        posSource.index(positions, myStartCursor),
        posSource.index(positions, myEndCursor)
      );
      updateSelection();
    }
    e.preventDefault();
  });

  textarea.addEventListener("cut", () => {
    const startIndex = posSource.index(positions, myStartCursor);
    const endIndex = posSource.index(positions, myEndCursor);
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
