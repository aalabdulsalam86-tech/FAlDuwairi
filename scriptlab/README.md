# AI Digit Lab — مختبر التعرف على الأرقام

A desktop app where you **write a digit with the mouse and watch a machine
learning model read it**, built with nothing but the four libraries in the
Grade 10 curriculum.

```
pip install scikit-learn pandas numpy matplotlib
python digit_lab.py
```

No internet, no download, no dataset file to manage — `load_digits()` ships
inside scikit-learn (1797 images, 8×8 pixels), which is exactly the "small
dataset" a demo needs.

---

## The four tabs

| Tab | What happens | Why it lands in a presentation |
|---|---|---|
| **1 — Draw a digit** | Write on squared paper, see the 8×8 numbers the model receives, and watch ten confidence bars slide to their new values as you write | This is the moment the audience reacts to |
| **2 — The data** | The pandas DataFrame as a real table, plus 18 dataset images drawn by matplotlib | Shows that "data" is just a table of numbers |
| **3 — Train and test** | Pick one of four models, move the `test_size` and `k` sliders, press Train. The accuracy curve draws itself point by point and the confusion matrix is revealed row by row | This is the ML content of the project |
| **4 — Where it fails** | Every test digit the model misread, marked in red pen | Honest, and an easy question to answer in the discussion |

## Where each library does its job

Useful if the marking sheet asks you to point at them:

- **scikit-learn** — `load_digits()`, `train_test_split()`, four classifiers
  (`KNeighborsClassifier`, `SVC`, `LogisticRegression`, `DecisionTreeClassifier`),
  `accuracy_score`, `confusion_matrix`
- **pandas** — the 1797 × 65 `DataFrame`, `head()`, `shape`, `value_counts()`,
  `drop()`; the table in tab 2 is rendered straight from it
- **numpy** — the drawing *is* a numpy array; cropping, centring and the
  `reshape(8, 4, 8, 4).sum(axis=(1, 3))` block count that turns 32×32 into 8×8
- **matplotlib** — the learning curve, the confusion matrix heatmap and both
  image galleries, embedded in the window with `FigureCanvasTkAgg`

## The one idea worth explaining on stage

The dataset was originally made by scanning digits as **32×32 black-and-white
bitmaps**, then counting the ink in each **4×4 block** to get an 8×8 image with
values from 0 to 16. The drawing pad is a 32×32 grid and the heavy lines on it
mark those 4×4 blocks — so the app does to your handwriting exactly what the
researchers did to theirs. That is why a mouse drawing and a 1990s scanned form
end up in the same format, and why the model accepts it.

```python
box.reshape(8, 4, 8, 4).sum(axis=(1, 3))   # 1024 squares -> 64 features
```

---

## A five minute demo script

1. **Open on tab 2.** "This is the data. 1797 handwritten digits, each one is
   64 numbers and one correct answer." Press *Show different images* twice.
2. **Tab 3.** Leave it on K-Nearest Neighbours, press **Train the model**. Talk
   while the curve draws: with 60 examples it is already around 80%, with all
   1437 it reaches about 98%. Point at `test_size = 20%`: "the score comes from
   360 digits the model has never seen."
3. **Switch the model to Decision Tree and train again.** Accuracy drops to
   about 84% — then switch to Support Vector Machine for about 99%. Same data,
   same code, different algorithm. This comparison is the strongest part of the
   project.
4. **Tab 1.** Write a 3 slowly and let them watch the bars fight over 3, 8 and 5
   before settling. Clear, write a deliberately bad 7, and show it fail.
5. **Tab 4.** "Here is everything it got wrong — most of these are hard for us
   too." Finish there; it reads as honest rather than as a flaw.

**Keyboard during the demo:** `Enter` predicts, `Esc` clears, `r` drops a real
dataset digit onto the pad — useful if your handwriting is not cooperating in
front of an audience.

## Questions you will get, and the answers

- **"Why is the Decision Tree always 100% sure and still wrong?"** It answers by
  following one path of yes/no questions, so it has no notion of doubt. KNN and
  logistic regression weigh several possibilities, which is why their bars move.
- **"Why 8×8 and not a big photo?"** 64 features train in under a second on a
  classroom laptop. A 28×28 image means 784 features and a much slower demo.
- **"Is this a neural network?"** No — and that is the point. These are the
  classical algorithms in the syllabus, and they reach 99% on this task.

## If you want to extend it

- Add a fifth model (`RandomForestClassifier`) to the radio buttons — one line
  in `make_model()`.
- Let students collect their own handwriting: save each drawing's 64 features
  with its label into a CSV through pandas, then train on the class's own data.
- Swap in `load_iris()` or `load_wine()` on a second screen to show the same
  four lines of scikit-learn solving a completely different problem.

## Interface language

Labels are kept in English because Tkinter does not reshape or reverse Arabic
text reliably across Windows and macOS. If you want an Arabic interface, the
clean route is a `LABELS` dictionary at the top of the file plus
`arabic-reshaper` and `python-bidi` — but those are outside the four approved
libraries, so the slides and the spoken explanation are usually the better place
for the Arabic.

---

# Script Lab — letters and digits

`script_lab.py` is the same project widened from 10 handwritten digits to
**36 characters**: the capitals `A`–`Z` and the digits `0`–`9`.

```powershell
py script_lab.py
```

Still only the four approved libraries. Nothing extra to install.

## Where the dataset comes from

scikit-learn ships handwritten digits but no letters, and there is no public
letter dataset small enough to demo — so `alphabet_data.py` **generates** one:

1. **matplotlib draws** each character into a 96×96 picture, in every font on
   the computer that genuinely contains that glyph.
2. **numpy varies** each drawing: rotate ±9°, shift a few squares, scale 84–100%,
   thicken the stroke sometimes.
3. The same crop-centre-and-count recipe turns each one into 64 numbers.
4. **pandas** stores all 2,160 images as a table and caches it in
   `alphabet_dataset.csv`.

Takes under two seconds on the first run, then loads instantly. Delete the CSV
to rebuild — on Windows it picks up Arial, Times New Roman, Georgia, Verdana,
Tahoma, Calibri, Segoe UI, Consolas, Courier New and Trebuchet MS, so you get
far more variety than my test machine had.

Two details worth knowing before you trust the generator:

- matplotlib draws a hollow box when a font lacks a glyph, and it does so
  *silently*. The generator asks FreeType directly
  (`FT2Font.get_char_index`) whether each font file really contains each
  character, so the dataset never fills with pictures of empty boxes.
- The cache is checked against the current character set, not just its shape.
  Change `GROUPS` and it rebuilds instead of quietly loading the old data.

## What to expect

With `test_size = 25%` on 2,160 images:

| Model | Accuracy |
|---|---|
| Support Vector Machine | **97.6%** |
| Logistic Regression | 93.3% |
| K-Nearest Neighbours (k=1) | 89.1% |
| Decision Tree | 66.1% |

Thirteen mistakes out of 540 test images for the SVM, and the spread between
algorithms is far wider than it was with ten digits — which makes tab 3 a much
better demonstration than before.

## The thing to say out loud in the presentation

**Some characters cannot be told apart, and that is not a bug.**

The mistakes the SVM makes are almost all the same handful of pairs:

- **0 and O** — the same shape; this is exactly why programmers write a slashed
  zero, and why a form asking for a licence plate tells you which it wants
- **1 and I** — a vertical stroke either way
- **8 and B**, **2 and Z**, **5 and S**, **O and Q** — one stroke apart

No amount of training data fixes these, because the information is not in the
picture. A human reads them from the surrounding word, or from the shape of the
font. Real OCR solves it with **context**, not with a better algorithm. That is
the most valuable slide in the project: the limit is in the data, not in the
code.

## Choices I made, in case you want to change them

- **Capitals only.** Lowercase is deliberately excluded: after each image is
  scaled to a fixed size, `c` and `C`, `o` and `O`, `s` and `S`, `x` and `X`
  are identical pictures. Add `string.ascii_lowercase` to `GROUPS` in
  `alphabet_data.py` if you want to show that effect on purpose.
- **No punctuation.** Add `list(".,!?;:")` as another group if you want it back;
  expect a full stop to start fighting with a nought.
- **8×8 features, 64-square pad.** I tested 8×8 against 16×16 and accuracy
  barely moved, because the limit is shape ambiguity, not resolution. Drawing
  resolution mattered much more — rendering onto a 64-square grid instead of 32
  was worth about twenty points, which is why the pad is finer than the digits
  version even though the output is still 64 numbers.
- **SVM is the default model** here rather than KNN, because with 36 classes KNN
  falls eight points behind.

# Putting it on GitHub Pages, and the QR code

Students cannot run Python on their phones, and GitHub Pages only serves files —
it does not run code. So the web version does the training in Python as usual,
then **exports the finished model** so the browser can do the recognising by
itself. `docs/index.html` is a single page with no server and no dependencies.

## 1. Export the model

```powershell
py export_web.py
```

Writes `docs/model.js` (about 206 KB, which compresses to roughly 40 KB over the
wire). Re-run it whenever you change the dataset.

Two models ship to the browser:

- **Logistic regression**, 93.3% — needs only a 36×64 table of weights, so it
  is almost free. This is what the page opens with.
- **Nearest neighbour**, 89.1% — needs the training table, so all 2,160 images
  are packed one byte per feature and base64-encoded. In exchange, the page can
  show you *the actual training images closest to what you drew*, which is the
  best explanation of the algorithm I know of. One tap on the toggle.

The support vector machine stays in the desktop app: at 97.6% it is much the
most accurate, but it needs 1,329 support vectors and 46,000 dual coefficients,
and the pairwise voting it uses is far more code to get right in JavaScript.

## 2. Test it locally first

```powershell
py -m http.server 8000 --directory docs
```

Then open `http://localhost:8000/`. Opening `index.html` by double-clicking will
not work — browsers block the model file over `file://`.

## 3. Publish

```powershell
git init
git add .
git commit -m "Grade 10 AI project"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/script-lab.git
git push -u origin main
```

Then on github.com: **Settings → Pages → Source: Deploy from a branch →
`main` / `/docs` → Save**. Give it a minute; your address will be

```
https://YOUR-USERNAME.github.io/script-lab/
```

## 4. Point the QR code at it

Open `script_lab.py` and set the line near the top:

```python
APP_URL = "https://YOUR-USERNAME.github.io/script-lab/"
```

Now `py script_lab.py` shows the code first, drawing itself row by row, with a
**Continue to the desktop app** button. Skip it with `py script_lab.py --no-qr`.

To add the same splash to `digit_lab.py`, put `import qr` at the top and these
two lines in front of `DigitLab().mainloop()`:

```python
qr.splash("https://YOUR-USERNAME.github.io/script-lab/",
          title="Open on your own device")
```

**If the school wifi blocks GitHub**, leave `APP_URL` as it is. The app then
generates a code pointing at your own laptop instead — start
`py -m http.server 8000 --directory docs` first, and make sure the phones are on
the same network.

For a slide or a printed handout:

```python
import qr
qr.save_png("https://YOUR-USERNAME.github.io/script-lab/", "qr.png")
```

## The QR code is written from scratch

There is a `qrcode` package on PyPI, but it is not one of your four libraries,
so `qr.py` builds the code from the ISO specification with numpy only: byte
mode, error correction level M, versions 1–10 (any URL up to 213 characters).

It is a genuinely nice thing to point at during the presentation, because a QR
code is **Reed–Solomon error correction over GF(256)** laid out in a spiral —
the same family of maths that protects CDs and satellite links. That is why a
code still scans with a thumb over the corner of it.

I verified it module-for-module against the reference `qrcode` library across
versions 1 to 10 before removing that library. The one difference: python-qrcode
picks its mask pattern by scoring a test image with the format bits blanked out,
while `qr.py` scores the finished symbol the way the standard says. Reproduce
that quirk and the two agree on all eleven test cases.

## The web version looks different on purpose

The desktop app is a squared exercise book — light, so it survives a classroom
projector. The web version is dark with a phosphor-cyan signal colour and
monospace readouts, because it is being read on a phone held close to the face,
usually in a room with the lights down.

The browser code is not a reimplementation that might drift from the Python. I
extracted the page's own functions and ran them under Node against the numpy
pipeline over 40 random scribbles: the 64 features come out **bit-identical**,
and both models pick the same character as scikit-learn every time.

That test earned its keep — it caught a real bug. Python's `round()` breaks ties
to the even number while JavaScript's `Math.round` rounds half up, so a drawing
whose crop scaled to exactly `n.5` squares came out one pixel different in the
browser. Both sides now use `int(x + 0.5)`, which has no ties to break.
