% !TEX root = ORNL-letter-example.tex
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% File: ornl-letter.cls
% Authors: Sam Crawford (crawfordst.@ornl.gov)
% Date: Wednesday, May 15 13:41:46 2024
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\NeedsTeXFormat{LaTeX2e}[1995/12/01]
\ProvidesClass{ornl-letter}[2024/05/15 ORNL Letter class]

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% OPTIONS
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\ProcessOptions\relax
\LoadClass[12pt]{letter}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% STYLING
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\RequirePackage[document]{ragged2e} % Aligns document ragged right
\usepackage{graphicx} % Required for including images
\usepackage{xcolor,soul} % For defining ORNL green
\usepackage{blindtext} % Used to fill example
\usepackage{fancyhdr} % Required for customizing headers and footers
\usepackage{array} % Adds tabular function to letter class
\usepackage{graphicx}
\usepackage[utf8]{inputenc} % Required for inputting international characters
\usepackage[T1]{fontenc} % Output font encoding for international characters

\definecolor{ORNL_green}{RGB}{0,121,52} % Define ORNL green for horizontal rules

% Load document style
%\RequirePackage{ornltm-style}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% GEOMETRY
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% 

\usepackage[
	a4paper, % Paper size, use letterpaper for US letter paper
	top=4cm, % Top margin
	bottom=2.5cm, % Bottom margin
	left=2cm, % Left margin
	right=2cm, % Right margin
	headsep=1cm, % Space from the top margin to the baseline of the header
	footskip=1.2cm, % Space from the bottom margin to the baseline of the footer
    headheight=2.0cm, %
	%showframe % Uncomment to show frames around the margins for debugging purposes
]{geometry}

\setlength{\parindent}{0pt} % Paragraph indentation
\setlength{\parskip}{1em} % Vertical space between paragraphs

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% VARIABLES
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%%%%%%%%%%
% Typist
%%%%%%%%%%

% Typist name (\typistname)
\newif\if@typistnamedefined
%\@typistnamedefinedfalse
%\def\@typistname{TYPIST NAME UNDEFINED%
%\PackageWarning{ornl-letter}{No typist name has been defined.}}
\newcommand{\typistname}[1]{\def\@typistname{#1}\@typistnamedefinedtrue}

% Typist initials (\typistint)
\newif\if@typistintdefined
\@typistintdefinedfalse
\def\@typistint{TYPIST INITIALS UNDEFINED%
\PackageWarning{ornl-letter}{No typist initials have been defined.}}
\newcommand{\typistint}[1]{\def\@typistint{#1}\@typistintdefinedtrue}

% Typist email (\typistemail)
\newif\if@typistemaildefined
%\@typistemaildefinedfalse
%\def\@typistemail{TYPIST EMAIL UNDEFINED%
%\PackageWarning{ornl-letter}{No typist email has been defined.}}
\newcommand{\typistemail}[1]{\def\@typistemail{#1}\@typistemaildefinedtrue}

%%%%%%%%%%
% Sender
%%%%%%%%%%

% Sender name (\sendername)
\newif\if@sendernamedefined
%\@sendernamedefinedfalse
%\def\@sendername{SENDER NAME UNDEFINED%
%\PackageWarning{ornl-letter}{No sender name has been defined.}}
\newcommand{\sendername}[1]{\def\@sendername{#1}\@sendernamedefinedtrue}

% Sender initials (\senderint)
\newif\if@senderintdefined
\@senderintdefinedfalse
\def\@senderint{SENDER INITIALS UNDEFINED%
\PackageWarning{ornl-letter}{No sender initials have been defined.}}
\newcommand{\senderint}[1]{\def\@senderint{#1}\@senderintdefinedtrue}

% Sender title (\sendertitle)
\newif\if@sendertitledefined
\@sendertitledefinedfalse
\def\@sendertitle{SENDER TITLE UNDEFINED%
\PackageWarning{ornl-letter}{No sender title has been defined.}}
\newcommand{\sendertitle}[1]{\def\@sendertitle{#1}\@sendertitledefinedtrue}

% Sender email (\senderemail)
\newif\if@senderemaildefined
\@senderemaildefinedfalse
\def\@senderemail{SENDER EMAIL UNDEFINED%
\PackageWarning{ornl-letter}{No sender email has been defined.}}
\newcommand{\senderemail}[1]{\def\@senderemail{#1}\@senderemaildefinedtrue}

% Sender phone (\senderphone)
\newif\if@senderphonedefined
\@senderphonedefinedfalse
\def\@senderphone{SENDER PHONE UNDEFINED%
\PackageWarning{ornl-letter}{No sender phone has been defined.}}
\newcommand{\senderphone}[1]{\def\@senderphone{#1}\@senderphonedefinedtrue}

% Sender (return) address (\senderadd)
\newif\if@senderadddefined
\@senderadddefinedfalse
\def\@senderadd{SENDER RETURN ADDRESS UNDEFINED%
\PackageWarning{ornl-letter}{No sender return address has been defined.}}
\newcommand{\senderadd}[1]{\def\@senderadd{#1}\@senderadddefinedtrue}

%%%%%%%%%%%%%%%%%%%%%%%%
%% RECIPIENT/ADDRESSEE
%%%%%%%%%%%%%%%%%%%%%%%%

% Recipient name (\recipientname)
\newif\if@recipientnamedefined
\@recipientnamedefinedfalse
\def\@recipientname{RECIPIENT NAME UNDEFINED%
\PackageWarning{ornl-letter}{No recipient name has been defined.}}
\newcommand{\recipientname}[1]{\def\@recipientname{#1}\@recipientnamedefinedtrue}

% Recipient title (\recipienttitle)
\newif\if@recipienttitledefined
%\@recipienttitledefinedfalse
%\def\@recipienttitle{RECIPIENT TITLE UNDEFINED%
%\PackageWarning{ornl-letter}{No recipient title has been defined.}}
\newcommand{\recipienttitle}[1]{\def\@recipienttitle{#1}\@recipienttitledefinedtrue}

% Recipient email (\recipientemail)
\newif\if@recipientemaildefined
\@recipientemaildefinedfalse
\def\@recipientemail{RECIPIENT EMAIL UNDEFINED%
\PackageWarning{ornl-letter}{No recipient email has been defined.}}
\newcommand{\recipientemail}[1]{\def\@recipientemail{#1}\@recipientemaildefinedtrue}

% Recipient phone (\recipientphone)
\newif\if@recipientphonedefined
\@recipientphonedefinedfalse
\def\@recipientphone{RECIPIENT PHONE UNDEFINED%
\PackageWarning{ornl-letter}{No recipient phone number has been defined.}}
\newcommand{\recipientphone}[1]{\def\@recipientphone{#1}\@recipientphonedefinedtrue}

% Recipient address (\recipientadd)
\newif\if@recipientadddefined
\@recipientadddefinedfalse
\def\@recipientadd{RECIPIENT ADDRESS UNDEFINED%
\PackageWarning{ornl-letter}{No recipient address has been defined.}}
\newcommand{\recipientadd}[1]{\def\@recipientadd{#1}\@recipientadddefinedtrue}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% SUBJECT LINE AND SALUTATION
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

% Subject line (\subjectline)
\newif\if@subjectlinedefined
\@subjectlinedefinedfalse
\def\@subjectline{SUBJECT LINE UNDEFINED%
\PackageWarning{ornl-letter}{No subject line has been defined.}}
\newcommand{\subjectline}[1]{\def\@subjectline{#1}\@subjectlinedefinedtrue}

% Salutation (\salutation)
% \newif\if@salutationdefined
% \@salutationdefinedfalse
% \def\@salutation{SALUTATION UNDEFINED%
% \PackageWarning{ornl-letter}{No salutation has been defined.}}
% \newcommand{\salutation}[1]{\def\@salutation{#1}\@salutationdefinedtrue}

%%%%%%%%%%%%
%% CLOSING
%%%%%%%%%%%%

% Complimentary close (\compclose)
\newif\if@compclosedefined
\@compclosedefinedfalse
\def\@compclose{COMP CLOSE UNDEFINED%
\PackageWarning{ornl-letter}{No close has been defined.}}
\newcommand{\compclose}[1]{\def\@compclose{#1}\@compclosedefinedtrue}

%%%%%%%%%%%%
%% CC List
%%%%%%%%%%%%

% Level 1 manager's name (\levelone)
\newif\if@levelonedefined
\@levelonedefinedfalse
\def\@levelone{LEVEL 1 UNDEFINED%
\PackageWarning{ornl-letter}{No Level-1 manager has been defined.}}
\newcommand{\levelone}[1]{\def\@levelone{#1}\@levelonedefinedtrue}

% Deputy of S&T's name (\deputyst)
\newif\if@deputystdefined
\@deputystdefinedfalse
\def\@deputyst{DEPUTY OF S\&T UNDEFINED%
\PackageWarning{ornl-letter}{No Deputy of S\&T has been defined.}}
\newcommand{\deputyst}[1]{\def\@deputyst{#1}\@deputystdefinedtrue}

% Deputy of Operations's name (\deputyops)
\newif\if@deputyopsdefined
\@deputyopsdefinedfalse
\def\@deputyops{DEPUTY OF OPS UNDEFINED%
\PackageWarning{ornl-letter}{No Deputy of Operations has been defined.}}
\newcommand{\deputyops}[1]{\def\@deputyops{#1}\@deputyopsdefinedtrue}

% Chief of Staff's name (\chiefofstaff)
\newif\if@chiefofstaffdefined
\@chiefofstaffdefinedfalse
\def\@chiefofstaff{CHIEF OF STAFF UNDEFINED%
\PackageWarning{ornl-letter}{No chief of staff has been defined.}}
\newcommand{\chiefofstaff}[1]{\def\@chiefofstaff{#1}\@chiefofstaffdefinedtrue}

% CC list (\cclist)
\newif\if@cclistdefined
\newcommand{\cclist}[1]{\def\@cclist{#1}\@cclistdefinedtrue}

%% Enclosure switch
\newif\if@enclosuredefined
\newcommand{\enclosure}[1]{\def\@enclosure{#1}\@enclosuredefinedtrue}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% HEADER AND FOOTER
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\fancypagestyle{firstpage}{%
	\fancyhf{} % Clear default headers/footers
    \renewcommand{\headrulewidth}{0pt} % No header rule
    \fancyhead[L]{ % Adding logo to left header
        \includegraphics[width=0.30\textwidth]{ORNL_Two-line_color.png}
        }
    \fancyhead[C]{\raggedleft\textcolor{ORNL_green}{\rule{0.69\textwidth}{0.75pt}}} % Green hrule for center (expands outward left and right)
    \fancyhead[R]{ % Adding address to right header
        \raggedleft % Right align text
        \scriptsize % Font size
            \textsf{ % Sans Serif
                \@senderadd\\%
                \@senderphone $~|~$ \@sendername\\%
                \vspace{-0.25cm}%
                }
    }
     
    \fancyfoot[]{%
    \textcolor{ORNL_green}{\rule{\textwidth}{0.75pt}} \\%
    \tiny\textsf{\textbf{\textcolor{black}{\hfill MANAGED BY UT-BATTELLE LLC FOR THE US DEPARTMENT OF ENERGY}}}
    }
}

\fancypagestyle{subsequentpages}{%
	\fancyhf{} % Clear default headers/footers
    \renewcommand{\headrulewidth}{0pt} % No header rule	
	\fancyhead[L]{%
    \@recipientname \\
    Page~\thepage \\%
    \@date \\% 
    } 
}
\AtBeginDocument{\thispagestyle{firstpage}} % Use the first page headers/footers style on the first page
\pagestyle{subsequentpages} % Use the subsequent pages headers/footers style on subsequent pages

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% ADDRESS BLOCK AND SUBJECT LINE
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\newcommand\printaddblock{%

\@date

\bigskip  % Vertical whitespace

\if@recipienttitledefined{
\@recipientname \\
\@recipienttitle \\	
\@recipientadd
}\else
\@recipientname \\
\@recipientadd
\fi

\bigskip % Vertical whitespace

% \@salutation

\bigskip % Vertical whitespace

\textbf{\@subjectline}

\smallskip % Vertical whitespace

} % end \printaddblock

\newcommand\printclose{%

\smallskip % Vertical whitespace
\@compclose
\bigskip\bigskip\bigskip % Vertical whitespace

\@sendername \\
\@sendertitle

\smallskip

\if@typistintdefined{
\@senderint:\@typistint % Prints sender intials and typist initials
}\else
\@senderint
\fi

\smallskip

\if@enclosuredefined{%Adds switch for enclosure on/off in example
Enclosure  
\smallskip%
}\else%
\fi

% Creating CC blocks
\if@cclistdefined{
    \parbox[t]{1.5cm}{c:}
    \parbox[t]{6cm}{\@levelone \\ \@deputyops \\ \@deputyst \\ \@cclist}
    \parbox[t]{6cm}{\@chiefofstaff \\ File--RC}
}
\else%
\parbox[t]{1.5cm}{c:}
\parbox[t]{6cm}{\@levelone \\ \@deputyops \\ \@deputyst}
\parbox[t]{6cm}{\@chiefofstaff \\ File--RC}
\fi
} % end \printclose

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\endinput
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% end of Exnihilo/environment/latex/ornl-letter.cls
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
