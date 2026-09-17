import React from "react";
import RoommateFindAModal from "./RoommateFindAModal";
import RoommateCandidateModal from "./RoommateCandidateModal";
import RoommateRequesterModal from "./RoommateRequesterModal";
import RoommateShareRequestModal from "./RoommateShareRequestModal";

export default function RoommateModals(props) {
  return (
    <>
      <RoommateFindAModal
        showFindA={props.showFindA}
        findAStudents={props.findAStudents}
        closeFindA={props.closeFindA}
        myProfile={props.myProfile}
        setSelectedId={props.setSelectedId}
        setFindAStudents={props.setFindAStudents}
        findARandomStudents={props.findARandomStudents}
      />
      <RoommateCandidateModal
        selected={props.selected}
        setSelectedId={props.setSelectedId}
        openMessage={props.openMessage}
        showToast={props.showToast}
        onFindRoommate={props.onFindRoommate}
        interested={props.interested}
        toggleInterested={props.toggleInterested}
        setTab={props.setTab}
      />
      <RoommateRequesterModal
        selectedRequester={props.selectedRequester}
        setSelectedRequesterId={props.setSelectedRequesterId}
        focusProperty={props.focusProperty}
        onFindRoommate={props.onFindRoommate}
        selectedRequesterCompatibility={props.selectedRequesterCompatibility}
        openRequesterMessage={props.openRequesterMessage}
        showToast={props.showToast}
      />
      <RoommateShareRequestModal
        showRequestForm={props.showRequestForm}
        setShowRequestForm={props.setShowRequestForm}
        requestFormLocked={props.requestFormLocked}
        focusProperty={props.focusProperty}
        requestForm={props.requestForm}
        setRequestForm={props.setRequestForm}
        pickableProperties={props.pickableProperties}
        submittingRequest={props.submittingRequest}
        handlePublishRequest={props.handlePublishRequest}
        inputStyle={props.inputStyle}
      />
    </>
  );
}
