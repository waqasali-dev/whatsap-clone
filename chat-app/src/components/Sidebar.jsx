import React, { useState, useEffect, useRef } from "react";
import SearchIcon from '@mui/icons-material/Search';
import "./Sidebar.css";
import { io } from "socket.io-client";

function Sidebar(props) {

    const [conversations, setConversations] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const socketRef = useRef();
    const [openChat, setOpenChat] = useState("");

    useEffect(() => {
        // Connect to socket.io server
        socketRef.current = io("http://localhost:5000");
    }, []);

    // This will set the receivedMsg flag to true for the highlighted conversation
    useEffect(() => {
        if (props.sidebarHighlight){
            console.log("Sidebar highlight ID:", props.sidebarHighlight);
        }
        const highlightId = props.sidebarHighlight.from;
        setConversations(prevConversations =>
            prevConversations.map(conversation => {
                if (conversation.connected_id === highlightId) {
                    return { ...conversation, receivedMsg: true };
                }
                return conversation;
            })
        );
    }, [props.sidebarHighlight]);

    useEffect(() => {
        if (props.userId && socketRef.current) {
            socketRef.current.emit("get_user_conversations", { userId: props.userId });

            // Changed from .once to .on to allow re-fetching if needed
            socketRef.current.on("user_conversations", (response) => {
                const updatedConversations = response.map(conversation => ({
                    ...conversation,
                    receivedMsg: conversation.unread_count > 0
                }));
                setConversations(updatedConversations);
            });
        }
        return () => {
            if (socketRef.current) {
                socketRef.current.off("user_conversations");
            }
        };
    }, [props.userId]);


    return (
        <div className="sidebar">
            <div className="chatHeader">
                <h2>Chat Box</h2>
                <p className="userId">User ID: {props.userId}</p>
                <div className="findUser">
                    <input
                        className="findUserInput"
                        type="text"
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Find user by id..."
                    />
                    <button
                        className="findUserBtn"
                        onClick={() => {
                            if (props.userId === inputValue) {
                                alert("You cannot chat with yourself!");
                            } else if (!inputValue) {
                                alert("Please enter a user ID to find.");
                            } else {
                                props.checkExistance(inputValue);
                            }
                        }}
                    >
                        <SearchIcon className="searchIcon" />
                    </button>
                </div>
            </div>
            <div className="chats">
                {conversations.map((conversation) => {
                    return (
                        <div className={`chatWith ${conversation.receivedMsg && openChat !== conversation.connected_id ? "receivedMsg" :  ""}`}
                            key={conversation.conversation_id}
                            id={conversation.connected_id}
                            onClick={() => {
                                props.checkExistance(conversation.connected_id);
                                setOpenChat(conversation.connected_id);
                                setConversations(prevConversations =>
                                    prevConversations.map(c =>
                                        c.connected_id === conversation.connected_id
                                            ? { ...c, receivedMsg: false }
                                            : c
                                    )
                                );
                                console.log("Clicked on conversation with ID: ", conversation);
                            }}>
                            <h3>{conversation.connected_id}</h3>
                        </div>
                    )
                })}
            </div>

        </div>
    )
}

export default Sidebar;